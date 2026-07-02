/* eslint-disable */
/**
 * Diagnóstico SOLO LECTURA de la estandarización. Usa el mismo data.json que la
 * migración y reporta, contra la BD real, qué pasaría SIN modificar nada.
 * No ejecuta UPDATE/DELETE.
 */
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const data = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../src/database/migrations/1782007200000-StandardizeServiceTypeNames.data.json'),
    'utf8',
  ),
);

// quita caracteres de control (0x00-0x1f y 0x7f) sin regex/escapes
const clean = (s) =>
  Array.from(String(s))
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c > 31 && c !== 127;
    })
    .join('')
    .trim();

(async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USERNAME,
    password: `${process.env.DB_PASSWORD}`,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const sts = (await client.query('SELECT id, name FROM service_types WHERE "deletedAt" IS NULL')).rows;
  const byClean = new Map();
  const byName = new Map();
  for (const r of sts) {
    const k = clean(r.name);
    if (!byClean.has(k)) byClean.set(k, []);
    byClean.get(k).push(r.id);
    byName.set(r.name, r.id);
  }
  const priceActors = async (table, actorCol) => {
    const rows = (await client.query(`SELECT "serviceTypeId" AS st, "${actorCol}" AS actor FROM "${table}"`)).rows;
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.st)) m.set(r.st, []);
      m.get(r.st).push(r.actor);
    }
    return m;
  };
  const ins = await priceActors('insurance_service_prices', 'insuranceId');
  const doc = await priceActors('doctor_service_prices', 'doctorId');
  const cc = await priceActors('care_center_service_prices', 'careCenterId');
  const ostCount = new Map();
  for (const r of (await client.query('SELECT "serviceTypeId" AS st, count(*) c FROM order_service_types GROUP BY "serviceTypeId"')).rows)
    ostCount.set(r.st, parseInt(r.c, 10));

  const refCount = (id) =>
    (ins.get(id)?.length || 0) + (doc.get(id)?.length || 0) + (cc.get(id)?.length || 0) + (ostCount.get(id) || 0);

  const resolveIds = (g) => {
    const set = new Set();
    for (const v of g.variants) {
      (byClean.get(clean(v)) || []).forEach((id) => set.add(id));
      if (byName.has(v)) set.add(byName.get(v));
    }
    if (byName.has(g.canonical)) set.add(byName.get(g.canonical));
    (byClean.get(clean(g.canonical)) || []).forEach((id) => set.add(id));
    return [...set];
  };

  let g0 = 0, g1 = 0, g2 = 0;
  let losers = 0, insDrop = 0, docDrop = 0, ccDrop = 0;
  const unmatched = [];
  const canonCollisions = [];
  const conflictGroups = [];

  for (const g of data.groups) {
    const ids = resolveIds(g);
    if (ids.length === 0) { g0++; unmatched.push(g.canonical); continue; }
    if (ids.length === 1) {
      g1++;
      const existing = byName.get(g.canonical);
      if (existing && existing !== ids[0]) canonCollisions.push(g.canonical);
      continue;
    }
    g2++;
    const survivor = ids.slice().sort((a, b) => refCount(b) - refCount(a))[0];
    const groupLosers = ids.filter((x) => x !== survivor);
    losers += groupLosers.length;
    const conflictFor = (m) => {
      const sActors = new Set(m.get(survivor) || []);
      let drop = 0;
      for (const l of groupLosers) for (const a of (m.get(l) || [])) if (sActors.has(a)) drop++;
      return drop;
    };
    const ci = conflictFor(ins), cd = conflictFor(doc), cce = conflictFor(cc);
    insDrop += ci; docDrop += cd; ccDrop += cce;
    if (ci + cd + cce > 0) conflictGroups.push({ canonical: g.canonical, ins: ci, doc: cd, cc: cce });
  }

  const delExisting = [];
  for (const n of data.deletes) if (byName.has(n)) delExisting.push(n);
  let delPrices = 0, delOrders = 0;
  for (const n of delExisting) {
    const id = byName.get(n);
    delPrices += (ins.get(id)?.length || 0) + (doc.get(id)?.length || 0) + (cc.get(id)?.length || 0);
    delOrders += (ostCount.get(id) || 0);
  }

  console.log('=== DIAGNOSTICO ESTANDARIZACION (read-only) ===');
  console.log(`service_types activos: ${sts.length}`);
  console.log(`grupos totales: ${data.groups.length}`);
  console.log(`  -> resuelven a >=2 filas (FUSION real): ${g2}`);
  console.log(`  -> resuelven a 1 fila (solo renombrar):  ${g1}`);
  console.log(`  -> NO matchean ninguna fila (0):         ${g0}`);
  console.log(`filas service_types ELIMINADAS por fusion (perdedores): ${losers}`);
  console.log(`basura: listados ${data.deletes.length}, existen ${delExisting.length} (precios ${delPrices}, en ordenes ${delOrders})`);
  console.log(`precios DESCARTADOS por conflicto -> seguro: ${insDrop}, doctor: ${docDrop}, centro: ${ccDrop}`);
  console.log(`reduccion neta service_types: ${losers + delExisting.length} (de ${sts.length} a ~${sts.length - losers - delExisting.length})`);
  if (canonCollisions.length) {
    console.log(`\n[!] canonicos que colisionan con nombre existente FUERA del grupo: ${canonCollisions.length}`);
    console.log(canonCollisions.join(' | '));
  }
  if (unmatched.length) {
    console.log(`\n[!] grupos sin match en BD (no haran nada): ${unmatched.length}`);
    console.log(unmatched.join(' | '));
  }
  if (conflictGroups.length) {
    console.log(`\nGrupos con conflicto de precio (${conflictGroups.length}) - top 15 por seguro:`);
    conflictGroups.sort((a, b) => b.ins - a.ins).slice(0, 15).forEach((c) => console.log(`  seg:${c.ins} doc:${c.doc} cen:${c.cc}  ${c.canonical}`));
  }

  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
