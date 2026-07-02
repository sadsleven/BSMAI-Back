/* eslint-disable */
/**
 * Auditoría SOLO LECTURA de la estandarización: usando los backups `_bkp_std_*`
 * (estado pre-migración) vs el estado actual, verifica que NINGÚN actor (seguro /
 * doctor / centro) perdió la cobertura de un estudio al fusionarse los duplicados.
 * Para cada actor: su conjunto de estudios CANÓNICOS antes ⊆ estudios ahora.
 * Reporta violaciones (pérdidas reales) y el dedup (duplicados removidos).
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

const stripControl = (s) =>
  Array.from(String(s)).filter((ch) => { const c = ch.charCodeAt(0); return c > 31 && c !== 127; }).join('');
const stripAccents = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const normKey = (s) => stripAccents(stripControl(s)).toUpperCase().trim();

const canonByNorm = {};
for (const g of data.groups) for (const v of [...g.variants, g.canonical]) canonByNorm[normKey(v)] = g.canonical;
const delNorms = new Set(data.deletes.map(normKey));

// mismo criterio que el seeder (incluye fallback RX. -> "RX ")
function canonicalName(raw) {
  const cleaned = stripControl(raw).trim();
  const k = normKey(cleaned);
  if (delNorms.has(k)) return null;
  return canonByNorm[k] ?? cleaned.replace(/^RX\.\s*/, 'RX ');
}

const ACTORS = [
  ['insurance_service_prices', 'insuranceId', 'seguro'],
  ['doctor_service_prices', 'doctorId', 'doctor'],
  ['care_center_service_prices', 'careCenterId', 'centro'],
];

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

  const bkName = new Map(
    (await client.query('SELECT id, name FROM "_bkp_std_service_types"')).rows.map((r) => [r.id, r.name]),
  );
  const curName = new Map(
    (await client.query('SELECT id, name FROM service_types')).rows.map((r) => [r.id, r.name]),
  );

  console.log('=== AUDITORIA ESTANDARIZACION (backups vs actual) ===');
  for (const [table, actorCol, label] of ACTORS) {
    const pre = new Map(); // actor -> Set(canonical)
    let prePairs = 0, basura = 0;
    for (const r of (await client.query(`SELECT "${actorCol}" AS actor, "serviceTypeId" AS st FROM "_bkp_std_${table}"`)).rows) {
      prePairs++;
      const nm = bkName.get(r.st);
      const canon = nm == null ? null : canonicalName(nm);
      if (canon === null) { basura++; continue; }
      if (!pre.has(r.actor)) pre.set(r.actor, new Set());
      pre.get(r.actor).add(canon);
    }
    const post = new Map(); // actor -> Set(currentName)
    let postPairs = 0;
    for (const r of (await client.query(`SELECT "${actorCol}" AS actor, "serviceTypeId" AS st FROM "${table}"`)).rows) {
      postPairs++;
      const nm = curName.get(r.st);
      if (nm == null) continue;
      if (!post.has(r.actor)) post.set(r.actor, new Set());
      post.get(r.actor).add(nm);
    }
    // violaciones: canónico que estaba antes y no está ahora
    const violations = [];
    let preCanonPairs = 0;
    for (const [actor, set] of pre) {
      const have = post.get(actor) || new Set();
      for (const canon of set) {
        preCanonPairs++;
        if (!have.has(canon)) violations.push({ actor, canon });
      }
    }
    console.log(`\n[${label}] tabla ${table}`);
    console.log(`  pares antes: ${prePairs} (basura excluida: ${basura}) | pares canónicos distintos antes: ${preCanonPairs}`);
    console.log(`  pares ahora: ${postPairs}`);
    console.log(`  dedup (duplicados removidos): ${preCanonPairs - postPairs >= 0 ? preCanonPairs - postPairs : 0}`);
    console.log(`  >>> PERDIDAS DE COBERTURA: ${violations.length}`);
    if (violations.length) {
      for (const v of violations.slice(0, 25)) console.log(`      actor=${v.actor}  estudio="${v.canon}"`);
      if (violations.length > 25) console.log(`      ...y ${violations.length - 25} más`);
    }
  }

  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
