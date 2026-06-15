/**
 * Dev-time tool: lee los .xlsx de /baremos y genera
 * src/seed/baremos/baremos.data.ts (datos horneados, sin dependencia de xlsx
 * en runtime). Re-ejecutar si cambian los Excel: `node scripts/parse-baremos.js`.
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/Abrahams/Documents/Proyectos Personales/AFMI/baremos';
const OUT = path.join(__dirname, '..', 'src', 'seed', 'baremos', 'baremos.data.ts');
const OUT_DOC = path.join(__dirname, '..', 'src', 'seed', 'baremos', 'baremos-doctors.data.ts');

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (typeof v.result === 'string') return v.result;
    if (typeof v.text === 'string') return v.text;
    return '';
  }
  return String(v);
}
function cellNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v.result === 'number') return v.result;
    v = cellText(v);
  }
  let s = String(v).trim().replace(/\$/g, '').replace(/usd/gi, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
const norm = (v) => cellText(v).replace(/\s+/g, ' ').trim();
const round2 = (n) => Math.round(n * 100) / 100;

// nombre = fila de sección/categoría, no un servicio real
const CATEGORY_RE = /^(consultas|consultas y procedimientos|laboratorios|imagenologia|rayos x|especialidades|tomografias|servicios|servicio de imagen)/i;

const CONFIGS = [
  {
    file: 'BAREMO PREVISORA ENERO 2026.xlsx',
    insurance: 'Seguros La Previsora',
    rif: null,
    sheets: [
      { name: 'CONSULTAS Y PROCEDIMIENTOS', nameCol: 3, priceCol: 4, startRow: 11 },
      { name: 'LABORATORIOS', nameCol: 2, priceCol: 3, startRow: 11 },
      { name: 'IMAGENOLOGIA', nameCol: 2, priceCol: 3, startRow: 11 },
    ],
  },
  {
    // Sólo APS: actos quirúrgicos / gastos clínicos excluidos por decisión de negocio
    file: 'BAREMO SEGUROS ALTAMIRA FEBRERO 2026.xlsx',
    insurance: 'Seguros Altamira',
    rif: null,
    sheets: [{ name: 'APS', nameCol: 2, priceCol: 4, startRow: 12 }],
  },
  {
    file: 'BAREMOS ACTUAL ESTAR SEGUROS.xlsx',
    insurance: 'Estar Seguros',
    rif: null,
    sheets: [{ name: 'APS', nameCol: 2, priceCol: 3, startRow: 11 }],
  },
  {
    file: 'BAREMOS CONSTITUCION.xlsx',
    insurance: 'Seguros Constitución',
    rif: null,
    sheets: [{ name: 'BAREMO AMP ', nameCol: 1, priceCol: 3, startRow: 6 }],
  },
  {
    file: 'BAREMOS ENVIASITENCIA.xlsx',
    insurance: 'Enviasistencia',
    rif: null,
    sheets: [
      { name: 'CONSULTAS ', nameCol: 2, priceCol: 3, startRow: 12 },
      { name: 'TOMOGRAFIAS ', nameCol: 2, priceCol: 3, startRow: 9 },
    ],
  },
  {
    file: 'BAREMOS HISPANA.xlsx',
    insurance: 'La Hispana',
    rif: null,
    sheets: [{ name: 'APS', nameCol: 2, priceCol: 3, startRow: 11 }],
  },
  {
    file: 'BAREMOS SEG. VENEZUELA.xlsx',
    insurance: 'Seguros Venezuela',
    rif: null,
    sheets: [{ name: 'BAREMO AMP 2025', nameCol: 1, priceCol: 2, startRow: 7 }],
  },
];

(async () => {
  const out = [];
  for (const cfg of CONFIGS) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, cfg.file));
    const m = new Map(); // UPPER key -> { name, priceUsd }
    let skippedLong = 0;
    for (const sc of cfg.sheets) {
      const ws = wb.getWorksheet(sc.name);
      if (!ws) {
        console.log('!! missing sheet', cfg.file, JSON.stringify(sc.name));
        continue;
      }
      for (let r = sc.startRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const name = norm(row.getCell(sc.nameCol).value);
        const price = cellNum(row.getCell(sc.priceCol).value);
        if (!name || CATEGORY_RE.test(name)) continue;
        if (price === null || price <= 0) continue;
        if (name.length > 200) {
          skippedLong++;
          continue;
        }
        const key = name.toUpperCase();
        if (!m.has(key)) m.set(key, { name, priceUsd: round2(price) });
      }
    }
    const services = [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const prices = services.map((s) => s.priceUsd);
    out.push({ name: cfg.insurance, rif: cfg.rif, services });
    console.log(
      cfg.insurance.padEnd(24),
      'svc:', String(services.length).padStart(4),
      'min:', Math.min(...prices),
      'max:', Math.max(...prices),
      skippedLong ? `(long-skip:${skippedLong})` : '',
    );
  }

  const total = new Set(out.flatMap((i) => i.services.map((s) => s.name.toUpperCase())));
  console.log('\nTOTAL tipos de servicio distintos:', total.size);

  const banner = `/**
 * AUTO-GENERADO por scripts/parse-baremos.js a partir de /baremos/*.xlsx.
 * NO editar a mano. Regenerar: \`node scripts/parse-baremos.js\`.
 *
 * Precios en USD. Cada seguro lista sólo los tipos de servicio que cubre.
 * El particularPriceUsd de cada tipo de servicio se deriva en el seeder
 * (máximo precio de seguro hallado). Actos quirúrgicos / gastos clínicos
 * y el baremo Particular (per-doctor) quedan fuera por ser de otro alcance.
 */

export interface BaremoServiceSeed {
  name: string;
  priceUsd: number;
}

export interface BaremoInsuranceSeed {
  name: string;
  rif: string | null;
  services: BaremoServiceSeed[];
}

export const BAREMO_INSURANCES: BaremoInsuranceSeed[] = `;

  const body = JSON.stringify(out, null, 2);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, banner + body + ';\n', 'utf8');
  console.log('\nwrote', path.relative(path.join(__dirname, '..'), OUT));

  // ---- BAREMOS PARTICULAR -> precios por doctor ----
  await parseDoctors();
})();

/**
 * BAREMOS PARTICULAR.xlsx: precios a pagar a doctores. Layout:
 *   - fila categoría: col C = especialidad (MEDICINA GENERAL, ...), sin costo
 *   - fila dato: col C = "DR./DRA. Nombre Apellido", col G = costo ("20$")
 * El tipo de servicio = la especialidad (consulta de esa especialidad).
 */
async function parseDoctors() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(dir, 'BAREMOS PARTICULAR.xlsx'));
  const ws = wb.getWorksheet('Hoja1');
  const rows = [];
  let category = null;
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const a = norm(row.getCell(1).value);
    const c = norm(row.getCell(3).value);
    const cost = cellNum(row.getCell(7).value);
    if (!c) continue;
    if (/^especialista$/i.test(c)) continue; // encabezado
    const isDoctor = /^dra?\.?\s/i.test(c);
    if (!isDoctor) {
      // fila de categoría (especialidad)
      if (!a && cost === null) category = c.toUpperCase();
      continue;
    }
    if (cost === null || cost <= 0 || !category) continue;
    const full = c.replace(/^dra?\.?\s+/i, '').replace(/\s+/g, ' ').trim();
    const parts = full.split(' ');
    const firstName = parts.shift();
    const lastName = parts.join(' ') || firstName;
    rows.push({
      firstName,
      lastName,
      cedula: 'SIN-CED-' + String(rows.length + 1).padStart(2, '0'),
      specialtyName: category,
      serviceTypeName: category,
      priceUsd: round2(cost),
    });
  }

  const banner = `/**
 * AUTO-GENERADO por scripts/parse-baremos.js a partir de
 * /baremos/BAREMOS PARTICULAR.xlsx. NO editar a mano.
 * Regenerar: \`node scripts/parse-baremos.js\`.
 *
 * Precios (USD) que se le pagan a cada doctor por la consulta de su
 * especialidad. El seeder crea el doctor (cédula placeholder SIN-CED-NN,
 * actualizar con la real), crea la especialidad y el tipo de servicio si no
 * existen, los vincula, y registra el precio en doctor_service_prices.
 */

export interface BaremoDoctorSeed {
  firstName: string;
  lastName: string;
  cedula: string;
  specialtyName: string;
  serviceTypeName: string;
  priceUsd: number;
}

export const BAREMO_DOCTORS: BaremoDoctorSeed[] = `;
  fs.writeFileSync(OUT_DOC, banner + JSON.stringify(rows, null, 2) + ';\n', 'utf8');
  console.log('wrote', path.relative(path.join(__dirname, '..'), OUT_DOC), '— doctores:', rows.length);
}
