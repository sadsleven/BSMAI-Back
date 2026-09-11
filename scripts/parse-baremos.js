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

// nombre = nota al pie del procedimiento anterior ("INCLUYE: USO DEL
// GASTROSCOPIO Y TOMA DE BIOPSIA" en Previsora), no un servicio propio
const NOTE_RE = /^incluye\s*:/i;

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
    // Agosto 2026 (reemplaza a BAREMO PREVISORA ENERO 2026.xlsx, obsoleto).
    // Consultas e imagenología traen la tarifa vieja ("COSTOS PREVISORA MARZO"),
    // el ajuste ("EQUIVALE 9,10%") y el precio negociado ("PRECIO ACTUALIZADO"):
    // vale el último. Laboratorios tiene una sola columna de precio.
    file: 'BAREMOS PREVISORA AGOSTO 2026.xlsx',
    insurance: 'C.N.A SEGUROS LA PREVISORA',
    aliases: ['Seguros La Previsora'],
    rif: null,
    sheets: [
      { name: 'CONSULTAS Y PROCEDIMIENTOS', nameCol: 3, priceCol: 6, startRow: 11 },
      { name: 'LABORATORIOS', nameCol: 2, priceCol: 3, startRow: 11 },
      { name: 'IMAGENOLOGIA', nameCol: 2, priceCol: 5, startRow: 11 },
    ],
  },
  {
    // Sólo APS: actos quirúrgicos / gastos clínicos excluidos por decisión de negocio
    file: 'BAREMO SEGUROS ALTAMIRA FEBRERO 2026.xlsx',
    insurance: 'SEGUROS ALTAMIRA, C.A',
    aliases: ['Seguros Altamira'],
    rif: null,
    sheets: [{ name: 'APS', nameCol: 2, priceCol: 4, startRow: 12 }],
  },
  {
    file: 'BAREMOS ACTUAL ESTAR SEGUROS.xlsx',
    insurance: 'ESTAR SEGUROS S.A',
    aliases: ['Estar Seguros'],
    rif: null,
    sheets: [{ name: 'APS', nameCol: 2, priceCol: 3, startRow: 11 }],
  },
  {
    file: 'BAREMOS CONSTITUCION.xlsx',
    insurance: 'SEGUROS CONSTITUCION, C.A',
    aliases: ['Seguros Constitución'],
    rif: null,
    sheets: [{ name: 'BAREMO AMP ', nameCol: 1, priceCol: 3, startRow: 6 }],
  },
  {
    file: 'BAREMOS ENVIASITENCIA.xlsx',
    insurance: 'ENVIASISTENCIA',
    aliases: ['Enviasistencia'],
    rif: null,
    sheets: [
      { name: 'CONSULTAS ', nameCol: 2, priceCol: 3, startRow: 12 },
      { name: 'TOMOGRAFIAS ', nameCol: 2, priceCol: 3, startRow: 9 },
    ],
  },
  {
    file: 'BAREMOS HISPANA.xlsx',
    insurance: 'HISPANA DE SEGUROS, S.A',
    aliases: ['La Hispana'],
    rif: null,
    sheets: [{ name: 'APS', nameCol: 2, priceCol: 3, startRow: 11 }],
  },
  {
    // Baremo cerrado del 03-08-2026 (reemplaza a BAREMOS SEG. VENEZUELA.xlsx,
    // obsoleto). La hoja registra la negociación en pares de columnas
    // AFMI/SEGVEN; las dos últimas (H e I, idénticas fila a fila) son el precio
    // CERRADO — ej. ECO DOPPLER 2M ARTERIAL: AFMI pidió 80, SEGVEN ofreció
    // 61,90 y cerró en 61,90. Los servicios que el seguro dejó fuera vienen con
    // "N/A" y quedan fuera solos (no son numéricos).
    file: 'BAREMOS SEG. VENEZUELA (03-08-2026).xlsx',
    insurance: 'SEGUROS VENEZUELA C.A',
    aliases: ['Seguros Venezuela'],
    rif: null,
    sheets: [{ name: 'BAREMOS CERRADOS', nameCol: 1, priceCol: 9, startRow: 8 }],
  },
  {
    // "PROPUESTA DE BAREMO": precio = columna "AFMI" en todas las hojas. La
    // segunda hoja de imágenes (sin espacio, col "Monto $") es un set distinto
    // del seguro y se omite por decisión de negocio (mantener criterio AFMI).
    // APS col9 = descripción del estudio (consultas → nombre de especialidad,
    // mapeado a "CONSULTA: X" por consultaName). Actos con "NO PROCEDE POR APS"
    // (Anatomía Patológica) quedan fuera.
    file: 'BAREMOS UNIVERSITAS.xlsx',
    insurance: 'SEGUROS UNIVERSITAS, C.A',
    aliases: ['Seguros Universitas'],
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
    insurance: 'SEGUROS PIRAMIDE, C.A',
    aliases: ['Seguros Pirámide'],
    rif: null,
    sheets: [{ name: 'AFMI', nameCol: 2, priceCol: 4, startRow: 4 }],
  },
  {
    // Hoja única "Hoja1" con la negociación: col C = servicio, col D = tarifa
    // propuesta por AFMI (01-07-2024) y col F = "PROPUESTA 1" del seguro
    // (15-07-2024), que trae o un monto (contraoferta) o el texto "APROBADO".
    // Precio vigente = col F si es numérica, si no col D. Las filas de sección
    // (LABORATORIO, RADIOLOGIA CONVENCIONAL, ECOGRAFIA, ...) no tienen monto en
    // col D y quedan fuera solas.
    file: 'BAREMOS OCEANICA.xlsx',
    insurance: 'OCEANICA DE SEGUROS, C.A',
    aliases: [],
    rif: null,
    sheets: [
      { name: 'Hoja1', nameCol: 3, priceCol: 4, altPriceCol: 6, startRow: 9 },
    ],
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
        const base = cellNum(row.getCell(sc.priceCol).value);
        // altPriceCol = columna de contraoferta: gana si trae monto (si trae
        // texto tipo "APROBADO" se queda el de priceCol).
        const alt = sc.altPriceCol ? cellNum(row.getCell(sc.altPriceCol).value) : null;
        if (!name || CATEGORY_RE.test(name) || NOTE_RE.test(name)) continue;
        if (base === null || base <= 0) continue;
        const price = alt !== null && alt > 0 ? alt : base;
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
    out.push({ name: cfg.insurance, aliases: cfg.aliases ?? [], rif: cfg.rif, services });
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
  /** Razón social oficial tal cual está registrada en el sistema. */
  name: string;
  /** Nombres anteriores/abreviados con los que pudo quedar creado el seguro. */
  aliases: string[];
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
 * Palabras de un PDF con coordenadas, página por página. `x` = borde izquierdo
 * y `y` = distancia desde el tope (pdfjs entrega el origen abajo-izquierda).
 * Devuelve `[[{ text, x, y }, ...], ...]` (un arreglo por página).
 */
async function pdfWords(file) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(path.join(dir, file)));
  const doc = await getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const height = page.getViewport({ scale: 1 }).height;
    const items = [];
    for (const it of (await page.getTextContent()).items) {
      const text = norm(it.str);
      if (!text) continue;
      items.push({ text, x: it.transform[4], y: height - it.transform[5] });
    }
    pages.push(items);
  }
  await doc.cleanup();
  return pages;
}

/**
 * Agrupa las palabras de una página en filas por su coordenada vertical. Las
 * celdas de una misma fila comparten línea base salvo un par de puntos, de ahí
 * la tolerancia (el paso entre filas de estos baremos es ≥ 16pt).
 */
function pdfRows(items, tol = 7) {
  const rows = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(it.y - last.y) <= tol) {
      last.items.push(it);
      last.y = (last.y + it.y) / 2;
    } else rows.push({ y: it.y, items: [it] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

/** Texto de las palabras de una fila cuyo `x` cae en [from, to). */
const cellAt = (row, from, to) =>
  row.items
    .filter((i) => i.x >= from && i.x < to)
    .map((i) => i.text)
    .join(' ')
    .trim();

/**
 * BAREMOS RISLAB.pdf: col izquierda = examen, col derecha = costo USD. Las
 * filas de categoría (Hematología, SEROLOGIA, ...) van centradas y sin costo,
 * así que se descartan solas al no traer precio. Cuando el nombre es largo la
 * celda del precio queda ~10pt más abajo que la del nombre y cae en su propia
 * fila: esas filas huérfanas (sólo precio) se pegan a la anterior.
 * Devuelve Map(consultKey -> { name, priceUsd }); ante nombre repetido
 * (Sodio/Potasio/Cloro salen en Química y en Orina) gana la primera aparición.
 */
async function parseLabPdf(file, splitX = 486) {
  const m = new Map();
  for (const items of await pdfWords(file)) {
    const rows = pdfRows(items);
    const merged = [];
    for (const row of rows) {
      const prev = merged[merged.length - 1];
      const onlyPrice = row.items.every((i) => i.x >= splitX);
      const prevNoPrice = prev && prev.items.every((i) => i.x < splitX);
      if (onlyPrice && prevNoPrice && row.y - prev.y <= 14) {
        prev.items.push(...row.items);
        continue;
      }
      merged.push(row);
    }
    for (const row of merged) {
      const name = cellAt(row, 0, splitX);
      const price = cellNum(cellAt(row, splitX, Infinity));
      if (!name || price === null || price <= 0) continue;
      const key = consultKey(name);
      if (!m.has(key)) m.set(key, { name, priceUsd: round2(price) });
    }
  }
  return m;
}

/** Columnas de BAREMOS CIMA.pdf (bordes en x del recuadro de la tabla). */
const CIMA_COLUMNS = {
  name: [64, 434],
  cash: [434, 470], // lo que CIMA le cobra a AFMI por un paciente de contado
  cima: [470, 512], // lo que le queda a CIMA descontada la comisión de AFMI
  afmi: [512, 548], // comisión de AFMI (13% del total facturado al seguro)
  seguro: [548, 592], // VALOR DEL SERVICIO = cima + afmi
};

/**
 * BAREMOS CIMA.pdf (CIMA, C.A — tomografías): tabla
 * `Nº | estudio | CASH | CIMA | AFMI 13% | SEGURO`. Los nombres largos se
 * parten en dos filas: la primera trae sólo el Nº y el inicio del nombre, y la
 * segunda el resto del nombre junto a los montos; se unen antes de leer.
 *
 * El valor del servicio es la columna **SEGURO** (el total, antes de separar el
 * 13% de AFMI que muestra la columna CIMA): de ahí salen tanto `priceUsd` (lo
 * que se registra para el centro) como `particularPriceUsd` (lo que cobra AFMI,
 * que PISA el particular del catálogo).
 */
async function parseCimaPdf() {
  const services = [];
  const cols = CIMA_COLUMNS;
  for (const items of await pdfWords('BAREMOS CIMA.pdf')) {
    let pending = null;
    for (const row of pdfRows(items)) {
      const rawCima = cellAt(row, ...cols.cima);
      const rawSeguro = cellAt(row, ...cols.seguro);
      const cima = cellNum(rawCima);
      const seguro = cellNum(rawSeguro);
      let name = cellAt(row, ...cols.name);
      if (cima === null || seguro === null) {
        // encabezado ("CIMA"/"SEGURO" en las columnas de monto): ni dato ni
        // continuación. El resto = primera línea de un nombre partido en dos.
        const isHeader = Boolean(rawCima || rawSeguro);
        pending = isHeader ? null : name || null;
        continue;
      }
      if (pending) name = `${pending} ${name}`.trim();
      pending = null;
      if (!name) continue;
      services.push({
        name,
        priceUsd: round2(seguro),
        particularPriceUsd: round2(seguro),
      });
    }
  }
  return services;
}

/**
 * Hoja de laboratorio en Excel: col A/B = examen (B a veces vacía), col C =
 * precio USD. Filas de categoría (Hematología, SEROLOGIA, ...) no tienen precio
 * y se omiten. Devuelve Map(consultKey -> { name, priceUsd }); ante nombre
 * repetido (Sodio/Potasio/Cloro aparecen en Química y en Orina con el mismo
 * precio) gana la primera aparición.
 *
 * Hoy sólo la usa BAREMOS PARTICULAR DEL LABORATORIO.xlsx (lo que cobra AFMI):
 * el costo del centro pasó a leerse de BAREMOS RISLAB.pdf (`parseLabPdf`).
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
 * Baremos de centros de atención → baremos-care-centers.data.ts. Son tres:
 *
 *  - RISLAB (LABORATORIO CLÍNICO RISLAB ORIENTE C.A.): el costo del centro sale
 *    de BAREMOS RISLAB.pdf (reemplazó a BAREMOS DEL LABORATORIO.xlsx, que quedó
 *    obsoleto) y el particular de AFMI de BAREMOS PARTICULAR DEL LABORATORIO.xlsx,
 *    unidos por examen normalizado. Los exámenes que sólo trae el PDF quedan sin
 *    particular (null = no se toca el del catálogo).
 *  - URIMECA (UNIDAD RADIOLÓGICA DE IMÁGENES MÉDICAS, C.A., RIF J-40093835-0):
 *    baremo por proyecciones del membrete BAREMOS URIMECA 2026.jpeg (no hay
 *    xlsx), horneado aquí. Sin precio particular (no fue suministrado).
 *  - CIMA (CIMA, C.A — tomografías): BAREMOS CIMA.pdf. `priceUsd` = columna
 *    CIMA (lo que se le paga al centro) y `particularPriceUsd` = columna SEGURO
 *    (lo que cobra AFMI, pisa el particular del catálogo). Los nombres del PDF
 *    llegan al catálogo vía BAREMO_NAME_ALIASES (mapean TAC/typos a los tipos de
 *    servicio ya existentes, sin crear duplicados).
 */
async function parseCareCenters() {
  const cost = await parseLabPdf('BAREMOS RISLAB.pdf');
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

  const cimaServices = await parseCimaPdf();

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
    {
      businessName: 'CIMA, C.A',
      rif: null,
      centerAddress: null,
      phones: [],
      specialtyName: 'TOMOGRAFIAS',
      services: cimaServices,
    },
  ];

  const banner = `/**
 * AUTO-GENERADO por scripts/parse-baremos.js a partir de
 * /baremos/BAREMOS RISLAB.pdf + BAREMOS PARTICULAR DEL LABORATORIO.xlsx
 * (RISLAB), /baremos/BAREMOS CIMA.pdf (CIMA) y del membrete
 * BAREMOS URIMECA 2026.jpeg (URIMECA, horneado en el script).
 * NO editar a mano.
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
    '| CIMA svc:',
    cimaServices.length,
  );
}
