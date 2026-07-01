/* eslint-disable */
/**
 * Revisa los nombres reales de los baremos (baremos.data.ts, horneado de los
 * xlsx) contra la estandarización: cobertura del mapa + DUPLICADOS/stragglers
 * residuales (nombres que tras canonicalName siguen colapsando entre sí o traen
 * prefijos raros). Solo lectura, no toca nada.
 */
const fs = require('fs');
const path = require('path');

const dataStd = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../src/database/migrations/1782007200000-StandardizeServiceTypeNames.data.json'),
    'utf8',
  ),
);
// extraer el array de baremos.data.ts
const tsTxt = fs.readFileSync(path.resolve(__dirname, '../src/seed/baremos/baremos.data.ts'), 'utf8');
const start = tsTxt.indexOf('= [') + 2;
const end = tsTxt.lastIndexOf(']') + 1;
const BAREMOS = JSON.parse(tsTxt.slice(start, end));

const stripControl = (s) => Array.from(String(s)).filter((ch) => { const c = ch.charCodeAt(0); return c > 31 && c !== 127; }).join('');
const stripAccents = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
const normKey = (s) => stripAccents(stripControl(s)).toUpperCase().trim();
const aggr = (s) => stripAccents(stripControl(s)).toUpperCase().replace(/[^A-Z0-9]+/g, '');

const canonByNorm = {};
for (const g of dataStd.groups) for (const v of [...g.variants, g.canonical]) canonByNorm[normKey(v)] = g.canonical;
const delNorms = new Set(dataStd.deletes.map(normKey));
function canonicalName(raw) {
  const cleaned = stripControl(raw).trim();
  const k = normKey(cleaned);
  if (delNorms.has(k)) return null;
  return canonByNorm[k] ?? cleaned.replace(/^RX\.\s*/, 'RX ');
}

// nombres distintos de baremo
const names = new Set();
for (const ins of BAREMOS) for (const s of ins.services) names.add(s.name);

let mapped = 0, passthrough = 0, basura = 0, rxDot = 0, ctrl = 0;
const canonicals = new Set();
const aggrMap = new Map(); // aggr -> Set(canonical)
for (const n of names) {
  const c = canonicalName(n);
  if (c === null) { basura++; continue; }
  if (canonByNorm[normKey(stripControl(n).trim())]) mapped++; else passthrough++;
  if (/^RX\./.test(c)) rxDot++;
  if (stripControl(c) !== c) ctrl++;
  canonicals.add(c);
  const a = aggr(c);
  if (!aggrMap.has(a)) aggrMap.set(a, new Set());
  aggrMap.get(a).add(c);
}

const residualDups = [...aggrMap.values()].filter((s) => s.size > 1).map((s) => [...s]);

console.log('=== REVISION BAREMOS XLSX vs ESTANDARIZACION ===');
console.log(`seguros: ${BAREMOS.length} | nombres de servicio distintos: ${names.size}`);
console.log(`  mapeados por la estandarizacion: ${mapped}`);
console.log(`  passthrough (singletons, sin cambio): ${passthrough}`);
console.log(`  basura (se omiten al seedear): ${basura}`);
console.log(`canonicos resultantes distintos: ${canonicals.size}`);
console.log(`[sanity] canonicos con prefijo "RX.": ${rxDot} | con control chars: ${ctrl}`);
console.log(`\nDUPLICADOS RESIDUALES (mismo nombre alfanumerico, distinta puntuacion/acento) que NO se fusionaron: ${residualDups.length}`);
for (const grp of residualDups) console.log('  - ' + grp.map((x) => `"${x}"`).join('  =?=  '));
