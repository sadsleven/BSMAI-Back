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
const OUT_CC = path.join(__dirname, '..', 'src', 'seed', 'baremos', 'baremos-care-centers.data.ts');

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
// Colapsa espacios y elimina caracteres de control (algunas celdas traen
// separadores de unidad U+001F al final, ej. Seguros Venezuela).
const norm = (v) =>
  cellText(v)
    .replace(/\s+/g, ' ')
    .split('')
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim();
const round2 = (n) => Math.round(n * 100) / 100;

// nombre = fila de sección/categoría, no un servicio real
const CATEGORY_RE = /^(consultas|consultas y procedimientos|laboratorios|imagenologia|rayos x|especialidades|tomografias|servicios|servicio de imagen)/i;

/** Quita diacríticos para comparar claves. */
const stripAccents = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
/** Clave de comparación: sin acentos, MAYÚSCULAS, espacios colapsados. */
const consultKey = (s) => stripAccents(s).replace(/\s+/g, ' ').toUpperCase().trim();

/**
 * Tipos de servicio que son CONSULTA de una especialidad (no exámenes ni
 * procedimientos). Claves normalizadas (sin acentos, MAYÚSCULAS). Las consultas
 * se renombran a "CONSULTA: <nombre>" tanto en seguros como en doctores.
 */
const SPECIALTY_CONSULT_KEYS = new Set([
  'CARDIOLOGIA',
  'CARDIOLOGIA / VASCULAR PERIFERICO / CARDIOVASCULAR',
  'CIRUGIA GENERAL',
  'DERMATOLOGIA',
  'ENDOCRINOLOGIA',
  'FISIATRIA',
  'GASTROENTEROLOGIA',
  'GASTROENTEROLOGIA / PROCTOLOGIA',
  'GINECOLOGIA',
  'GINECOLOGIA OBSTETRICIA',
  'INMUNOLOGIA',
  'MASTOLOGIA',
  'MEDICINA FAMILIAR',
  'MEDICINA GENERAL',
  'MEDICINA INTERNA',
  'NEFROLOGIA',
  'NEUMONOLOGIA',
  'NEUMONOLOGIA PEDRIATRICA',
  'NEUROCIRUGIA',
  'NEUROLOGIA',
  'NEUROLOGIA / NEUROCIRUGIA',
  'NUTRICION / DIETETICA',
  'NUTRICIONISTA',
  'ODONTOLIGIA',
  'OFTALMOLOGIA',
  'ONCOLOGIA',
  'ONCOLOGIA / MASTOLOGIA',
  'OTORRINOLARINGOLOGIA',
  'PEDIATRIA',
  'PSIQUIATRIA',
  'PSIQUIATRIA / PSICOLOGIA',
  'REHABILITACION / FISIATRIA',
  'REUMATOLOGIA',
  'TRAUMATOLOGIA',
  'UROLOGIA',
  'UROLOGO',
]);

/**
 * Nombre canónico de la especialidad por clave normalizada. Unifica variantes
 * (ej. UROLOGO/UROLOGIA → "UROLOGÍA"). Sin entrada → se usa el nombre original.
 */
const CONSULT_CANONICAL = new Map([
  ['UROLOGIA', 'UROLOGÍA'],
  ['UROLOGO', 'UROLOGÍA'],
]);

/** Prefija "CONSULTA: " si el nombre es una consulta de especialidad. */
const consultaName = (name) => {
  const key = consultKey(name);
  if (!SPECIALTY_CONSULT_KEYS.has(key)) return name;
  return `CONSULTA: ${CONSULT_CANONICAL.get(key) ?? name}`;
};

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
  {
    // "PROPUESTA DE BAREMO": precio = columna "AFMI" en todas las hojas. La
    // segunda hoja de imágenes (sin espacio, col "Monto $") es un set distinto
    // del seguro y se omite por decisión de negocio (mantener criterio AFMI).
    // APS col9 = descripción del estudio (consultas → nombre de especialidad,
    // mapeado a "CONSULTA: X" por consultaName). Actos con "NO PROCEDE POR APS"
    // (Anatomía Patológica) quedan fuera.
    file: 'BAREMOS UNIVERSITAS.xlsx',
    insurance: 'Seguros Universitas',
    rif: null,
    sheets: [
      { name: 'APS', nameCol: 9, priceCol: 10, startRow: 9 },
      { name: 'LABORATORIO', nameCol: 4, priceCol: 5, startRow: 9 },
      { name: 'IMAGENES ', nameCol: 5, priceCol: 6, startRow: 8 },
    ],
  },
  {
    // Hoja única "AFMI": col B = nombre del servicio, col D = costo USD. Los
    // nombres traen "CONSULTA 1A VEZ / DE CONTROL" y quedan tal cual (no son
    // consultas de especialidad simples mapeables).
    file: 'BAREMOS PIRAMIDE.xlsx',
    insurance: 'Seguros Pirámide',
    rif: null,
    sheets: [{ name: 'AFMI', nameCol: 2, priceCol: 4, startRow: 4 }],
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
        const display = consultaName(name);
        const key = display.toUpperCase();
        if (!m.has(key)) m.set(key, { name: display, priceUsd: round2(price) });
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

  // ---- Baremos de centros de atención (RISLAB + URIMECA) ----
  await parseCareCenters();
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
      serviceTypeName: 'CONSULTA: ' + category,
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

/**
 * Hoja de laboratorio (RISLAB): col A/B = examen (B a veces vacía), col C =
 * costo USD. Filas de categoría (Hematología, SEROLOGIA, ...) no tienen costo
 * y se omiten. Devuelve Map(consultKey -> { name, priceUsd }); ante nombre
 * repetido (Sodio/Potasio/Cloro aparecen en Química y en Orina con el mismo
 * precio) gana la primera aparición.
 */
async function parseLabSheet(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(dir, file));
  const ws = wb.getWorksheet('Hoja1');
  const m = new Map();
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = norm(row.getCell(1).value) || norm(row.getCell(2).value);
    const price = cellNum(row.getCell(3).value);
    if (!name || price === null || price <= 0) continue;
    const key = consultKey(name);
    if (!m.has(key)) m.set(key, { name, priceUsd: round2(price) });
  }
  return m;
}

/**
 * Baremos de centros de atención → baremos-care-centers.data.ts.
 *
 *  - RISLAB (LABORATORIO CLÍNICO RISLAB ORIENTE C.A.): dos xlsx con la misma
 *    estructura unidos por examen normalizado — BAREMOS DEL LABORATORIO.xlsx =
 *    lo que cobra el centro (care_center_service_prices) y BAREMOS PARTICULAR
 *    DEL LABORATORIO.xlsx = lo que cobra AFMI (particularPriceUsd del ST).
 *  - URIMECA (UNIDAD RADIOLÓGICA DE IMÁGENES MÉDICAS, C.A., RIF J-40093835-0):
 *    baremo por proyecciones del membrete BAREMOS URIMECA 2026.jpeg (no hay
 *    xlsx), horneado aquí. Sin precio particular (no fue suministrado).
 */
async function parseCareCenters() {
  const cost = await parseLabSheet('BAREMOS DEL LABORATORIO.xlsx');
  const particular = await parseLabSheet('BAREMOS PARTICULAR DEL LABORATORIO.xlsx');

  for (const key of particular.keys()) {
    if (!cost.has(key)) {
      console.log('!! examen sólo en BAREMOS PARTICULAR DEL LABORATORIO:', particular.get(key).name);
    }
  }
  let sinParticular = 0;
  const rislabServices = [...cost.values()]
    .map((s) => {
      const p = particular.get(consultKey(s.name));
      if (!p) sinParticular++;
      return {
        name: s.name,
        priceUsd: s.priceUsd,
        particularPriceUsd: p ? p.priceUsd : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (sinParticular) console.log('!! exámenes RISLAB sin precio particular:', sinParticular);

  const out = [
    {
      businessName: 'LABORATORIO CLÍNICO RISLAB ORIENTE C.A.',
      rif: null,
      centerAddress: null,
      phones: [],
      specialtyName: 'LABORATORIO',
      services: rislabServices,
    },
    {
      businessName: 'UNIDAD RADIOLÓGICA DE IMÁGENES MÉDICAS, C.A. (URIMECA)',
      rif: 'J-40093835-0',
      centerAddress:
        'Av. Sta. Rosa, Edif. Centro Médico Virgen del Valle, planta baja, Sector Santa Rosa, Cumaná',
      phones: [{ number: '02934333383', label: null }],
      specialtyName: 'RADIOLOGÍA',
      // Una "proyección" = complemento de un mismo estudio (ej. Tórax PA y
      // lateral = 2 proyecciones). El estudio concreto se nombra per orden
      // vía customName. Los STs son los canónicos ya existentes del catálogo
      // ("RX CUALQUIER PARTE DEL CUERPO (N PROYECCIONES)"); su particular
      // vigente se conserva (URIMECA no suministró precio particular).
      services: [
        { name: 'RX CUALQUIER PARTE DEL CUERPO (1 PROYECCIÓN)', priceUsd: 10, particularPriceUsd: null },
        { name: 'RX CUALQUIER PARTE DEL CUERPO (2 PROYECCIONES)', priceUsd: 15, particularPriceUsd: null },
        { name: 'RX CUALQUIER PARTE DEL CUERPO (3 PROYECCIONES)', priceUsd: 20, particularPriceUsd: null },
        { name: 'RX CUALQUIER PARTE DEL CUERPO (4 PROYECCIONES)', priceUsd: 25, particularPriceUsd: null },
      ],
    },
  ];

  const banner = `/**
 * AUTO-GENERADO por scripts/parse-baremos.js a partir de
 * /baremos/BAREMOS DEL LABORATORIO.xlsx + BAREMOS PARTICULAR DEL
 * LABORATORIO.xlsx (RISLAB) y del membrete BAREMOS URIMECA 2026.jpeg
 * (URIMECA, horneado en el script). NO editar a mano.
 * Regenerar: \`node scripts/parse-baremos.js\`.
 *
 * \`priceUsd\` = lo que cobra el centro (care_center_service_prices).
 * \`particularPriceUsd\` = lo que cobra AFMI por ese servicio; PISA el
 * particular del catálogo (fuente explícita de negocio). null = no tocar.
 */

export interface BaremoCareCenterServiceSeed {
  name: string;
  priceUsd: number;
  particularPriceUsd: number | null;
}

export interface BaremoCareCenterSeed {
  businessName: string;
  rif: string | null;
  centerAddress: string | null;
  phones: { number: string; label: string | null }[];
  specialtyName: string;
  services: BaremoCareCenterServiceSeed[];
}

export const BAREMO_CARE_CENTERS: BaremoCareCenterSeed[] = `;
  fs.writeFileSync(OUT_CC, banner + JSON.stringify(out, null, 2) + ';\n', 'utf8');
  console.log(
    'wrote',
    path.relative(path.join(__dirname, '..'), OUT_CC),
    '— centros:',
    out.length,
    '| RISLAB svc:',
    rislabServices.length,
  );
}
