/* eslint-disable */
/**
 * Parsea ESTANDARIZACION-BAREMOS.md (con las decisiones marcadas por el usuario)
 * y emite el JSON de datos que consume la migración StandardizeServiceTypeNames.
 *
 * Reglas:
 *  - Sección A: decisión "OK" => borrar; decisión con texto/`backtick` => renombrar.
 *  - Secciones E1..E9: cada fila = grupo {canonical, variants[]}. Decisión:
 *      "OK"  => usar canónico sugerido
 *      "NO"  => omitir (no fusionar)
 *      otro  => canónico = el texto que escribió el usuario
 *  - Los renombres (incluida sección A) se modelan como grupos de 1 variante.
 *
 * No toca la base de datos. Solo lee el .md y escribe un .json.
 */
const fs = require('fs');
const path = require('path');

const MD = path.resolve(__dirname, '../../ESTANDARIZACION-BAREMOS.md');
const OUT = path.resolve(
  __dirname,
  '../src/database/migrations/1782007200000-StandardizeServiceTypeNames.data.json',
);
// Mapa para el seeder de baremos (mismo origen). Clave = normKey (sin acentos+MAYUS).
const MAP_OUT = path.resolve(__dirname, '../src/seed/baremos/standardization-map.ts');

// mismo normKey que baremos-seed.service.ts
const stripControl = (s) =>
  Array.from(String(s))
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c > 31 && c !== 127;
    })
    .join('');
const stripAccents = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const normKey = (s) => stripAccents(stripControl(s)).toUpperCase().trim();

const md = fs.readFileSync(MD, 'utf8');
const lines = md.split(/\r?\n/);

const backticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const cellsOf = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());

let sec = null;
const deletes = [];
const renames = []; // {from,to}
const groups = []; // {canonical, variants[]}

for (const line of lines) {
  const h2 = line.match(/^##\s+([A-F])\.\s/);
  const h3 = line.match(/^###\s+E\d/);
  if (h2) {
    sec = h2[1] === 'A' ? 'A' : null;
    continue;
  }
  if (h3) {
    sec = 'E';
    continue;
  }
  if (!line.startsWith('|')) continue;
  const cells = cellsOf(line);
  if (cells.length < 2) continue;
  if (/^:?-{2,}:?$/.test(cells[0])) continue; // separador

  if (sec === 'A') {
    if (/^nombre$/i.test(cells[0])) continue; // header
    const names = backticks(cells[0]);
    if (!names.length) continue;
    const decision = cells[cells.length - 1];
    if (/^ok$/i.test(decision)) {
      names.forEach((n) => deletes.push(n));
    } else {
      const t = backticks(decision);
      const to = t.length ? t[0] : decision;
      if (to) names.forEach((n) => renames.push({ from: n, to }));
    }
  } else if (sec === 'E') {
    if (cells.length < 4) continue;
    if (/^canónico/i.test(cells[1]) || /^conf$/i.test(cells[0])) continue; // header
    const canonToks = backticks(cells[1]);
    if (!canonToks.length) continue;
    let canonical = canonToks[0];
    const variants = backticks(cells[2]);
    if (!variants.length) continue;
    const decision = cells[3];
    if (/^no$/i.test(decision)) continue;
    if (!/^ok$/i.test(decision)) {
      const t = backticks(decision);
      canonical = t.length ? t[0] : decision || canonical;
    }
    groups.push({ canonical, variants });
  }
}

// renombres (incl. LCR) => grupos de 1 variante
for (const r of renames) groups.push({ canonical: r.to, variants: [r.from] });

// dedup deletes
const delSet = [...new Set(deletes)];

const data = {
  generatedFrom: 'ESTANDARIZACION-BAREMOS.md',
  priceConflictRule: 'survivor', // 'survivor' | 'highest' | 'recent'
  hardDelete: true,
  deletes: delSet,
  groups,
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');

// --- Mapa para el seeder: normKey(variante) -> canónico, y normKeys de basura ---
const canonByNorm = {};
const collisions = [];
for (const g of groups) {
  for (const v of [...g.variants, g.canonical]) {
    const k = normKey(v);
    if (canonByNorm[k] && canonByNorm[k] !== g.canonical) {
      collisions.push({ key: k, a: canonByNorm[k], b: g.canonical });
    }
    canonByNorm[k] = g.canonical;
  }
}
const delNorms = [...new Set(delSet.map(normKey))];
const mapTs =
  '// AUTO-GENERADO por scripts/gen-baremos-standardization.cjs desde\n' +
  '// ESTANDARIZACION-BAREMOS.md. NO editar a mano (se sobrescribe).\n' +
  '// Clave = normKey (sin acentos, MAYUSCULAS, sin control chars). Lo consume\n' +
  '// baremos-seed.service.ts para mapear cada nombre de baremo a su canonico.\n\n' +
  'export const STD_CANONICAL_BY_NORMKEY: Record<string, string> = ' +
  JSON.stringify(canonByNorm, null, 2) +
  ';\n\nexport const STD_DELETE_NORMKEYS: string[] = ' +
  JSON.stringify(delNorms, null, 2) +
  ';\n';
fs.writeFileSync(MAP_OUT, mapTs, 'utf8');

// resumen
const totalVariants = groups.reduce((a, g) => a + g.variants.length, 0);
console.log('OUT:', OUT);
console.log('MAP_OUT:', MAP_OUT, '| normkeys canónicos:', Object.keys(canonByNorm).length, '| basura normkeys:', delNorms.length);
if (collisions.length) console.log('[!] colisiones normKey->canónico:', JSON.stringify(collisions));
console.log('deletes:', delSet.length, JSON.stringify(delSet));
console.log('renames:', renames.length, JSON.stringify(renames));
console.log('groups:', groups.length, '| variantes totales:', totalVariants);
console.log('grupos de 1 variante (solo renombrar):', groups.filter((g) => g.variants.length === 1).length);
console.log('--- muestra primeros 4 grupos ---');
console.log(JSON.stringify(groups.slice(0, 4), null, 2));
console.log('--- muestra últimos 3 grupos ---');
console.log(JSON.stringify(groups.slice(-3), null, 2));
