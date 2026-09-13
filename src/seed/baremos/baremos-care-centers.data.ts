/**
 * AUTO-GENERADO por scripts/parse-baremos.js a partir de
 * /baremos/BAREMOS RISLAB.pdf + BAREMOS PARTICULAR DEL LABORATORIO.xlsx
 * (RISLAB), /baremos/BAREMOS CIMA.pdf (CIMA) y del membrete
 * BAREMOS URIMECA 2026.jpeg (URIMECA, horneado en el script).
 * NO editar a mano.
 * Regenerar: `node scripts/parse-baremos.js`.
 *
 * `priceUsd` = lo que cobra el centro (care_center_service_prices).
 * `particularPriceUsd` = lo que cobra AFMI por ese servicio; PISA el
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

export const BAREMO_CARE_CENTERS: BaremoCareCenterSeed[] = [
  {
    businessName: 'LABORATORIO CLÍNICO RISLAB ORIENTE C.A.',
    rif: null,
    centerAddress: null,
    phones: [],
    specialtyName: 'LABORATORIO',
    services: [
      {
        name: 'ACIDO URICO',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
      {
        name: 'AFP',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'ALBUMINA',
        priceUsd: 2.5,
        particularPriceUsd: null,
      },
      {
        name: 'Amilasa',
        priceUsd: 3,
        particularPriceUsd: 4.5,
      },
      {
        name: 'ANA',
        priceUsd: 12,
        particularPriceUsd: 13.58,
      },
      {
        name: 'ANTI CCP',
        priceUsd: 16,
        particularPriceUsd: 17.5,
      },
      {
        name: 'ANTI- TG (ANTI TROGLOBULINA)',
        priceUsd: 10,
        particularPriceUsd: 11.5,
      },
      {
        name: 'ANTI-TPO (ANTIPEROXIDASA)',
        priceUsd: 10,
        particularPriceUsd: 11.5,
      },
      {
        name: 'ANTIGENOS FEBRILES',
        priceUsd: 10,
        particularPriceUsd: 11.5,
      },
      {
        name: 'ASLO',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'AZUCARES REDUCTORES',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'Bilirrubina total y Fraccionada',
        priceUsd: 2,
        particularPriceUsd: 3.5,
      },
      {
        name: 'BK-GRAM',
        priceUsd: 12,
        particularPriceUsd: 13.5,
      },
      {
        name: 'CA 15-3',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'CA 19-9',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'CA-125',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'Calcio',
        priceUsd: 3,
        particularPriceUsd: 4.5,
      },
      {
        name: 'CALCIO EN ORINA',
        priceUsd: 3,
        particularPriceUsd: 4.5,
      },
      {
        name: 'CEA',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'CERTIFICADO DE SALUD',
        priceUsd: 5,
        particularPriceUsd: 6.5,
      },
      {
        name: 'CHAGA TEST',
        priceUsd: 12,
        particularPriceUsd: 13.5,
      },
      {
        name: 'CHLAMDYA PNEUMONEAE IGM',
        priceUsd: 9,
        particularPriceUsd: 10.5,
      },
      {
        name: 'CK TOTAL',
        priceUsd: 7,
        particularPriceUsd: 8.5,
      },
      {
        name: 'CKM-B',
        priceUsd: 7,
        particularPriceUsd: 8.5,
      },
      {
        name: 'Cloro',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'CMV IGG/IGM (citomegalovirus)',
        priceUsd: 16,
        particularPriceUsd: 17.5,
      },
      {
        name: 'COCAINA',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'COPROCULTIVO',
        priceUsd: 26,
        particularPriceUsd: 27.5,
      },
      {
        name: 'CORTISOL',
        priceUsd: 10,
        particularPriceUsd: 11.5,
      },
      {
        name: 'Creatinina',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
      {
        name: 'CREATININA EN ORINA',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
      {
        name: 'CULTIVO DE LIQUIDOS CORPORALES (LCR, PLEURAL, ASCITICO, ETC)',
        priceUsd: 26,
        particularPriceUsd: 27.5,
      },
      {
        name: 'CULTIVO DE SECRESIONES (HERIDAS, ABSCESOS, URETAL, SEMINAL, ETC)',
        priceUsd: 26,
        particularPriceUsd: 27.5,
      },
      {
        name: 'Curva de tolerancia o carga 75 gr',
        priceUsd: 8,
        particularPriceUsd: 9.5,
      },
      {
        name: 'DEHAS',
        priceUsd: 9,
        particularPriceUsd: 10.5,
      },
      {
        name: 'DENGUE IGG/IGM',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'DENGUE NS1',
        priceUsd: 13,
        particularPriceUsd: 14.5,
      },
      {
        name: 'Depuración de Creatinina',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'DIMERO D',
        priceUsd: 15,
        particularPriceUsd: 16.5,
      },
      {
        name: 'EINSTER. BARR',
        priceUsd: 16,
        particularPriceUsd: 17.5,
      },
      {
        name: 'ELECTROLITOS SERICOS',
        priceUsd: 7.5,
        particularPriceUsd: 9,
      },
      {
        name: 'ESTRADIOL',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'ESTRIOL',
        priceUsd: 10,
        particularPriceUsd: 11.5,
      },
      {
        name: 'FERRITINA',
        priceUsd: 8,
        particularPriceUsd: 9.5,
      },
      {
        name: 'Fibrinógeno',
        priceUsd: 2,
        particularPriceUsd: 3.5,
      },
      {
        name: 'FOLATO (ACIDO FOLICO)',
        priceUsd: 11,
        particularPriceUsd: 12.5,
      },
      {
        name: 'Fosfatasa Alcalina',
        priceUsd: 1.8,
        particularPriceUsd: 3.3,
      },
      {
        name: 'Fosforo',
        priceUsd: 3,
        particularPriceUsd: 4.5,
      },
      {
        name: 'FOSFORO EN ORINA',
        priceUsd: 3,
        particularPriceUsd: 4.5,
      },
      {
        name: 'FSH',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'GGT',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'Glicemia',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
      {
        name: 'Glicemia basal y post-Pandrial',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'Gota Gruesa',
        priceUsd: 2,
        particularPriceUsd: 3.5,
      },
      {
        name: 'H. PILORY HECES',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'H. PILORY SANGRE',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'HCG',
        priceUsd: 3,
        particularPriceUsd: 4.5,
      },
      {
        name: 'HCG CUANTIFICADA',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'HECES',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
      {
        name: 'HECES SERIADAS',
        priceUsd: 4.5,
        particularPriceUsd: 6,
      },
      {
        name: 'Hematología completa',
        priceUsd: 2,
        particularPriceUsd: 3.5,
      },
      {
        name: 'HEMOCULTIVO',
        priceUsd: 26,
        particularPriceUsd: 27.5,
      },
      {
        name: 'HEMOGLOBINA GLICOSILADA',
        priceUsd: 12,
        particularPriceUsd: 13.5,
      },
      {
        name: 'HEPATITIS A',
        priceUsd: 5,
        particularPriceUsd: 6.5,
      },
      {
        name: 'HEPATITIS B antígeno de superficie',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'HEPATITIS B Core',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'HEPATITIS C',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'HERPES II',
        priceUsd: 5,
        particularPriceUsd: 6.5,
      },
      {
        name: 'Hierro',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'HISOPADO',
        priceUsd: 26,
        particularPriceUsd: null,
      },
      {
        name: 'HIV',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'IGE (INMONOGLOBULINA E)',
        priceUsd: 9,
        particularPriceUsd: 10.5,
      },
      {
        name: 'INSUINA BASAL',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'INSULINA POST-PANDRIAL',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'LDH',
        priceUsd: 1.8,
        particularPriceUsd: 3.3,
      },
      {
        name: 'LEUCOGRAMA FECAL',
        priceUsd: 2.5,
        particularPriceUsd: null,
      },
      {
        name: 'LH',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'LIPASA',
        priceUsd: 14,
        particularPriceUsd: 15.5,
      },
      {
        name: 'Magnesio',
        priceUsd: 3,
        particularPriceUsd: 4.5,
      },
      {
        name: 'MARIHUANA',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'MICROALBUMINURIA EN ORINA PARCIAL',
        priceUsd: 12,
        particularPriceUsd: 13.5,
      },
      {
        name: 'MYCOPLASMA IGM',
        priceUsd: 8,
        particularPriceUsd: 9.5,
      },
      {
        name: 'NT PRO BNP CUALITATIVO',
        priceUsd: 10,
        particularPriceUsd: 11.5,
      },
      {
        name: 'NT PRO BNP CUANTITATIVO',
        priceUsd: 21,
        particularPriceUsd: 22.5,
      },
      {
        name: 'ORINA',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
      {
        name: 'PCR',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'PERFIL 20',
        priceUsd: 33,
        particularPriceUsd: 34.5,
      },
      {
        name: 'PERFIL 20 BASICO',
        priceUsd: 20,
        particularPriceUsd: 12.5,
      },
      {
        name: 'PERFIL BASICO',
        priceUsd: 16,
        particularPriceUsd: 17.5,
      },
      {
        name: 'PERFIL CARDIACO',
        priceUsd: 25,
        particularPriceUsd: 26.5,
      },
      {
        name: 'PERFIL ESCOLAR',
        priceUsd: 9,
        particularPriceUsd: 10.5,
      },
      {
        name: 'PERFIL GENERAL',
        priceUsd: 11,
        particularPriceUsd: 12.5,
      },
      {
        name: 'PERFIL HEPATICO',
        priceUsd: 14,
        particularPriceUsd: 15.5,
      },
      {
        name: 'PERFIL I.T.S.',
        priceUsd: 12,
        particularPriceUsd: 13.5,
      },
      {
        name: 'PERFIL IZQUEMICO',
        priceUsd: 37.4,
        particularPriceUsd: 38.9,
      },
      {
        name: 'PERFIL LIPIDICO',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'PERFIL PRE-NATAL',
        priceUsd: 35,
        particularPriceUsd: 36.5,
      },
      {
        name: 'PERFIL PRE-OPERATORIO',
        priceUsd: 16,
        particularPriceUsd: 17.5,
      },
      {
        name: 'PERFIL RENAL',
        priceUsd: 13,
        particularPriceUsd: 14.5,
      },
      {
        name: 'PERFIL REUMATOIDEO',
        priceUsd: 13,
        particularPriceUsd: 14.5,
      },
      {
        name: 'PERFIL TIROIDEO',
        priceUsd: 12,
        particularPriceUsd: 13.5,
      },
      {
        name: 'Potasio',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'PROCALCITONINA (PTC)',
        priceUsd: 14,
        particularPriceUsd: 15.5,
      },
      {
        name: 'PROGESTERONA',
        priceUsd: 10,
        particularPriceUsd: 11.5,
      },
      {
        name: 'PROLACTINA',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'PROTEINA DE BENCE JONES (ORINA 24 HORAS)',
        priceUsd: 5,
        particularPriceUsd: 6.5,
      },
      {
        name: 'Proteínas totales y Fraccionada',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'Proteinuria',
        priceUsd: 3,
        particularPriceUsd: 4.5,
      },
      {
        name: 'PSA TOTAL Y LIBRE',
        priceUsd: 24,
        particularPriceUsd: 25.5,
      },
      {
        name: 'Pt + INR',
        priceUsd: 2,
        particularPriceUsd: 3.5,
      },
      {
        name: 'PTH',
        priceUsd: 16,
        particularPriceUsd: 17.5,
      },
      {
        name: 'PTT y PT',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'RATEST',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'RELACION AC. URICO/CREATININA',
        priceUsd: 5,
        particularPriceUsd: 6.5,
      },
      {
        name: 'RELACION ALBUMINA/CREATININA',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'RELACION CALCIO/CREATININA',
        priceUsd: 5,
        particularPriceUsd: 6.5,
      },
      {
        name: 'RELACION FOSFORO/CREATININA',
        priceUsd: 5,
        particularPriceUsd: 6.5,
      },
      {
        name: 'RELACION MAGNESIO/CREATININA',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'RUBEOLA IgG',
        priceUsd: 8,
        particularPriceUsd: 9.5,
      },
      {
        name: 'RUBEOLA IGM',
        priceUsd: 8,
        particularPriceUsd: 9.5,
      },
      {
        name: 'SANGRE OCULTA EN HECES',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'SECRECION DE PIE DIABETICO',
        priceUsd: 26,
        particularPriceUsd: 27.5,
      },
      {
        name: 'SECRECION DEL TRACTO RESPIRATORIO',
        priceUsd: 26,
        particularPriceUsd: 27.5,
      },
      {
        name: 'SECRECION OTICA',
        priceUsd: 26,
        particularPriceUsd: 27.5,
      },
      {
        name: 'SECRECION VAGINAL',
        priceUsd: 26,
        particularPriceUsd: 27.5,
      },
      {
        name: 'Sodio',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'T3 LIBRE',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'T4 LIBRE',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'TESTOSTERONA LIBRE',
        priceUsd: 11,
        particularPriceUsd: 12.5,
      },
      {
        name: 'TESTOSTERONA TOTAL',
        priceUsd: 6,
        particularPriceUsd: 7.5,
      },
      {
        name: 'TGO',
        priceUsd: 1.8,
        particularPriceUsd: 3.3,
      },
      {
        name: 'TGP',
        priceUsd: 1.8,
        particularPriceUsd: 3.3,
      },
      {
        name: 'Tipiaje',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'TIROPGLOBULINA',
        priceUsd: 10,
        particularPriceUsd: 11.5,
      },
      {
        name: 'TOXOPLASMA IGG/IGM',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'TRANSFERRINA',
        priceUsd: 9,
        particularPriceUsd: 10.5,
      },
      {
        name: 'Triglicéridos',
        priceUsd: 1.8,
        particularPriceUsd: 3.3,
      },
      {
        name: 'TROPONINA I',
        priceUsd: 15,
        particularPriceUsd: 16.5,
      },
      {
        name: 'TSH',
        priceUsd: 4,
        particularPriceUsd: 5.5,
      },
      {
        name: 'Urea',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
      {
        name: 'UREA EN ORINA',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
      {
        name: 'UROCULTIVO',
        priceUsd: 25,
        particularPriceUsd: 26.5,
      },
      {
        name: 'VDRL',
        priceUsd: 2.5,
        particularPriceUsd: 4,
      },
      {
        name: 'VITAMINA B12',
        priceUsd: 18,
        particularPriceUsd: 19.5,
      },
      {
        name: 'VITAMINA D',
        priceUsd: 12,
        particularPriceUsd: 13.5,
      },
      {
        name: 'VSG',
        priceUsd: 1.5,
        particularPriceUsd: 3,
      },
    ],
  },
  {
    businessName: 'UNIDAD RADIOLÓGICA DE IMÁGENES MÉDICAS, C.A. (URIMECA)',
    rif: 'J-40093835-0',
    centerAddress:
      'Av. Sta. Rosa, Edif. Centro Médico Virgen del Valle, planta baja, Sector Santa Rosa, Cumaná',
    phones: [
      {
        number: '02934333383',
        label: null,
      },
    ],
    specialtyName: 'RADIOLOGÍA',
    services: [
      {
        name: 'RX CUALQUIER PARTE DEL CUERPO (1 PROYECCIÓN)',
        priceUsd: 10,
        particularPriceUsd: null,
      },
      {
        name: 'RX CUALQUIER PARTE DEL CUERPO (2 PROYECCIONES)',
        priceUsd: 15,
        particularPriceUsd: null,
      },
      {
        name: 'RX CUALQUIER PARTE DEL CUERPO (3 PROYECCIONES)',
        priceUsd: 20,
        particularPriceUsd: null,
      },
      {
        name: 'RX CUALQUIER PARTE DEL CUERPO (4 PROYECCIONES)',
        priceUsd: 25,
        particularPriceUsd: null,
      },
    ],
  },
  {
    businessName: 'CIMA, C.A',
    rif: null,
    centerAddress: null,
    phones: [],
    specialtyName: 'TOMOGRAFIAS',
    services: [
      {
        name: 'TAC DE CRÁNEO SIN CONTRATE',
        priceUsd: 85,
        particularPriceUsd: 85,
      },
      {
        name: 'TAC DE CRÁNEO CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE CRÁNEO CON RECOSNTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE CUELLO SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE CUELLO CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE CUELLO CON RECOSNTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE TÓRAX SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE TÓRAX CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE SENOS PARANASALES SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE SENOS PARANASALES CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE SENOS PARANASALES CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE ÓRBITAS SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE ÓRBITAS CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE ÓIDO/MASTOIDE SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE ÓIDO/MASTOIDE CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE MACÍZO FACIAL SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE MACISO FACIAL CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE ABDOMEN Y PÉLVIS SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE ABDOMEN Y PÉLVIS CON CONTRASTE ORAL',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE ABDOMEN Y PÉLVIS CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE ABDOMEN Y PÉLVIS CON DOBLE CONTRASTE',
        priceUsd: 270,
        particularPriceUsd: 270,
      },
      {
        name: 'TAC DE CADERA SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE CADERA CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE CADERA CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE MIEMBROS SUPERIORES SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE MIEMBROS SUPERIORES CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE MIEMBROS SUPERIORES CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE MIEMBROS INFERIORES SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE MIEMBROS INFERIORES CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE MIEMBROS INFERIORES CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE COLUMNA CERVICAL SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE COLUMNA CERVICAL CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE COLUMNA CERVICAL CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE COLUMNA DORSAL SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE COLUMNA DORSAL CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE COLUMNA DORSAL CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'TAC DE COLUMNA LUMBAR SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'TAC DE COLUMNA LUMBAR CON RECONSTRUCCIÓN 3D',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'TAC DE COLUMNA LUMBAR CON CONTRASTE EV.',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'UROTAC SIN CONTRASTE',
        priceUsd: 110,
        particularPriceUsd: 110,
      },
      {
        name: 'UROTAC CON CONTRASTE EV.',
        priceUsd: 210,
        particularPriceUsd: 210,
      },
      {
        name: 'UROTAC CON RECONSTRUCCIÓN 3D',
        priceUsd: 230,
        particularPriceUsd: 230,
      },
      {
        name: 'ANGIOTAC ABDOMINAL CON CONTRASTE EV.',
        priceUsd: 280,
        particularPriceUsd: 280,
      },
      {
        name: 'ANGIOTAC ABDOMINAL CON CONTRASTE EV Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC DE TÓRAX CON CONTRASTE EV.',
        priceUsd: 280,
        particularPriceUsd: 280,
      },
      {
        name: 'ANGIOTAC DE TÓRAX CON CONTRASTE EV Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC RENAL CON CONTRASTE EV',
        priceUsd: 280,
        particularPriceUsd: 280,
      },
      {
        name: 'ANGIOTAC RENAL CON CONTRASTE EV Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC DE AORTA TORACICA CON CONTRASTE EV.',
        priceUsd: 280,
        particularPriceUsd: 280,
      },
      {
        name: 'ANGIOTAC DE AORTA TORACICA CON CONTRASTE EV. Y RECNSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC DE AORTA ABDOMINAL CON CONTRASTE EV.',
        priceUsd: 280,
        particularPriceUsd: 280,
      },
      {
        name: 'ANGIOTAC DE AORTA ABDOMINAL CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC DE MIEMBROS SUPERIORES CON CONTRASTE EV.',
        priceUsd: 280,
        particularPriceUsd: 280,
      },
      {
        name: 'ANGIOTAC DE MIEMBROS SUPERIORES CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC DE MIEMBROS INFERIORES CON CONTRASTE EV.',
        priceUsd: 280,
        particularPriceUsd: 280,
      },
      {
        name: 'ANGIOTAC DE MIEMBROS INFERIORES CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC DE VASOS SUPRAORTICO, CARÓTIDA O CUELLO CON CONTRASTE EV.',
        priceUsd: 280,
        particularPriceUsd: 280,
      },
      {
        name: 'ANGIOTAC DE VASOS SUPRAORTICO, CARÓTIDA O CUELLO CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC TORACICA/ABDOMINAL CON CONTRASTE EV',
        priceUsd: 295,
        particularPriceUsd: 295,
      },
      {
        name: 'ANGIOTAC TORACICA CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
      {
        name: 'ANGIOTAC ABDOMINAL CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D',
        priceUsd: 310,
        particularPriceUsd: 310,
      },
    ],
  },
];
