/**
 * AUTO-GENERADO por scripts/parse-baremos.js a partir de /baremos/*.xlsx.
 * NO editar a mano. Regenerar: `node scripts/parse-baremos.js`.
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

export const BAREMO_INSURANCES: BaremoInsuranceSeed[] = [
  {
    "name": "C.N.A SEGUROS LA PREVISORA",
    "aliases": [
      "Seguros La Previsora"
    ],
    "rif": null,
    "services": [
      {
        "name": "% SATURACION DE TRANSFERRINA",
        "priceUsd": 27
      },
      {
        "name": "ACIDO FOLICO",
        "priceUsd": 27
      },
      {
        "name": "ACIDO FOLICO ( FOLATOS )",
        "priceUsd": 30
      },
      {
        "name": "ACIDO URICO",
        "priceUsd": 27
      },
      {
        "name": "ACIDO URICO ORINA 24H",
        "priceUsd": 22
      },
      {
        "name": "ACIDO VALPROICO",
        "priceUsd": 38
      },
      {
        "name": "ADENOVIRUS ( EN HECES )",
        "priceUsd": 35
      },
      {
        "name": "ALFAFETOPROTEINA ( AFP )",
        "priceUsd": 22
      },
      {
        "name": "AMILASA",
        "priceUsd": 22
      },
      {
        "name": "AMONIO",
        "priceUsd": 22
      },
      {
        "name": "ANALISIS DE CAPAS DE FIBRAS NERVIOSAS (ACFN)",
        "priceUsd": 60
      },
      {
        "name": "ANGIOGRAFIA POR FLUORESCEINA",
        "priceUsd": 120
      },
      {
        "name": "ANTI CARDIOLOPINA ( IGG + IGM )",
        "priceUsd": 40
      },
      {
        "name": "ANTI CUERPOS ANTI DNA",
        "priceUsd": 22
      },
      {
        "name": "ANTI CUERPOS ANTI NUCLEARES (ANA)",
        "priceUsd": 27
      },
      {
        "name": "ANTI CUERPOS ANTI PEPTIDOS CITRULINADOS (ANTI-CCP)",
        "priceUsd": 37
      },
      {
        "name": "ANTI CUERPOS ANTI RNP",
        "priceUsd": 22
      },
      {
        "name": "ANTI CUERPOS ANTI SMITH",
        "priceUsd": 22
      },
      {
        "name": "ANTI FOSFOLIPIDOS",
        "priceUsd": 35
      },
      {
        "name": "ANTI TIROGLOBULINA (ANTI TG)",
        "priceUsd": 32
      },
      {
        "name": "ANTICUERPOS ANTIMICROSOMALES TPO ( ANTI TPO )",
        "priceUsd": 32
      },
      {
        "name": "ANTIESTREPTOLISINA (ASTO)",
        "priceUsd": 29
      },
      {
        "name": "ANTIGENO FEBRIL ( WIDAL )",
        "priceUsd": 25
      },
      {
        "name": "ANTIGENO PROSTATICO (PSA) LIBRE",
        "priceUsd": 38
      },
      {
        "name": "ANTIGENO PROSTATICO (PSA) TOTAL",
        "priceUsd": 38
      },
      {
        "name": "ARTROCENTESIS (1 ARTICULACION)",
        "priceUsd": 100
      },
      {
        "name": "ARTROCENTESIS (2 o MAS ARTICULACIONES)",
        "priceUsd": 150
      },
      {
        "name": "BILIRRUBINA TOTAL Y FRACCIONADA",
        "priceUsd": 22
      },
      {
        "name": "BIOMETRIA",
        "priceUsd": 60
      },
      {
        "name": "BIOPSIA DE CUELLO UTERINO POR ASA Y CAUTERIZACION",
        "priceUsd": 200
      },
      {
        "name": "BIOPSIA DE ENDOMETRIO Ó CUELLO",
        "priceUsd": 80
      },
      {
        "name": "BIOPSIA DE ENDOMETRIO Ó CUELLO POR ASA",
        "priceUsd": 200
      },
      {
        "name": "BIOPSIA POR PUNCIÓN CON AGUJA FINA GUIADAS POR ULTRASONIDO",
        "priceUsd": 400
      },
      {
        "name": "BIOPSIA POR PUNCIÓN CON AGUJA TRUCUT GUIADA POR ULTRASONIDO",
        "priceUsd": 700
      },
      {
        "name": "BUN (UREA)",
        "priceUsd": 22
      },
      {
        "name": "C.E.A.",
        "priceUsd": 37
      },
      {
        "name": "CA 125",
        "priceUsd": 37
      },
      {
        "name": "CA 15-3",
        "priceUsd": 37
      },
      {
        "name": "CA 19-9",
        "priceUsd": 37
      },
      {
        "name": "CALCIO",
        "priceUsd": 22
      },
      {
        "name": "CALCIO IONICO/SERICO",
        "priceUsd": 22
      },
      {
        "name": "CAMPO VISUAL COMPUTARIZADO",
        "priceUsd": 60
      },
      {
        "name": "CAMPO VISUAL DE COLORES",
        "priceUsd": 60
      },
      {
        "name": "CAPACIDAD DE FIJACION DE HIERRO",
        "priceUsd": 22
      },
      {
        "name": "CAPSULOTOMÍA YAG LASER BILATERAL",
        "priceUsd": 523
      },
      {
        "name": "CAPSULOTOMÍA YAG LASER UNILATERAL",
        "priceUsd": 400
      },
      {
        "name": "CARCINOMA BASOCELULAR",
        "priceUsd": 350
      },
      {
        "name": "CARCINOMA ESPINOCELULAR",
        "priceUsd": 550
      },
      {
        "name": "CELULAS L.E",
        "priceUsd": 27
      },
      {
        "name": "CITOMEGALOVIRUS ( IGG + IGM )",
        "priceUsd": 37
      },
      {
        "name": "CK",
        "priceUsd": 32
      },
      {
        "name": "CKMB",
        "priceUsd": 32
      },
      {
        "name": "CLORO",
        "priceUsd": 22
      },
      {
        "name": "COLESTEROL (HDL)",
        "priceUsd": 22
      },
      {
        "name": "COLESTEROL (LDL)",
        "priceUsd": 22
      },
      {
        "name": "COLESTEROL (VLDL)",
        "priceUsd": 22
      },
      {
        "name": "COLESTEROL TOTAL",
        "priceUsd": 22
      },
      {
        "name": "COLOCACIÓN DE HORMONOTERAPIA/BIFOSFONATOS PARA CANCER DE PROSTATA AVANZADO",
        "priceUsd": 80
      },
      {
        "name": "COLOCACION DE PROTESIS ESOFAGICAS (INCLUYE PROTESIS)",
        "priceUsd": 1600
      },
      {
        "name": "COLOCACIÓN Y/O CAMBIO DE SONDA DE FOLEY TRANS URETRAL (INCLUYE MATERIAL)",
        "priceUsd": 150
      },
      {
        "name": "COMPLEMENTO C3",
        "priceUsd": 65
      },
      {
        "name": "COMPLEMENTO C4",
        "priceUsd": 45
      },
      {
        "name": "COMPLEMENTO CH50",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA + CITOLOGÍA (INCLUYE EL ESTUDIO) + ECO TRANSVAGINAL",
        "priceUsd": 150
      },
      {
        "name": "CONSULTA + CITOLOGÍA (INCLUYE EL ESTUDIO) + ECO TRANSVAGINAL + COLPOSCOPIA TOMA DE BIOPSIA",
        "priceUsd": 200
      },
      {
        "name": "CONSULTA: CARDIOLOGIA / VASCULAR PERIFERICO / CARDIOVASCULAR",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: CIRUGIA GENERAL",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: DERMATOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: ENDOCRINOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: FISIATRIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: GASTROENTEROLOGIA / PROCTOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: GINECOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: INMUNOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: MEDICINA GENERAL",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: MEDICINA INTERNA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: NEFROLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: NEUMONOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: NEUROLOGIA / NEUROCIRUGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: NUTRICION / DIETETICA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: ODONTOLIGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: OFTALMOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: ONCOLOGIA / MASTOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: OTORRINOLARINGOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: PEDIATRIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: PSIQUIATRIA / PSICOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: REUMATOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: TRAUMATOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: UROLOGÍA",
        "priceUsd": 50
      },
      {
        "name": "CONTAJE DE CELULAS ENDOTELIALES / BIOMICROSCOPICA",
        "priceUsd": 75
      },
      {
        "name": "COPROCULTIVO",
        "priceUsd": 46
      },
      {
        "name": "CORTISOL TOTAL AM",
        "priceUsd": 27
      },
      {
        "name": "CORTISOL TOTAL PM",
        "priceUsd": 32
      },
      {
        "name": "CREATININA",
        "priceUsd": 22
      },
      {
        "name": "CREATININA EN ORINA",
        "priceUsd": 22
      },
      {
        "name": "CRIOCIRUGIA: Sesion CRIOSPRAY LESIONES BENIGNAS",
        "priceUsd": 200
      },
      {
        "name": "CULTIVO DE SECRECIONES",
        "priceUsd": 62
      },
      {
        "name": "CURAS DE QUEMADURAS",
        "priceUsd": 200
      },
      {
        "name": "CURETAJE DE LESIONES (SESION)",
        "priceUsd": 150
      },
      {
        "name": "CURVA DE INSULINA ( INCLUYE 3 TOMAS )",
        "priceUsd": 102
      },
      {
        "name": "CURVA DE TOLERANCIA (INCLUYE CARGA Y 3 TOMAS)",
        "priceUsd": 22
      },
      {
        "name": "CURVA DE TOLERANCIA GLUCOSADA 120",
        "priceUsd": 22
      },
      {
        "name": "CURVA DE TOLERANCIA GLUCOSADA 30",
        "priceUsd": 22
      },
      {
        "name": "CURVA DE TOLERANCIA GLUCOSADA 60",
        "priceUsd": 22
      },
      {
        "name": "CURVA DE TOLERANCIA GLUCOSADA 90",
        "priceUsd": 22
      },
      {
        "name": "DEBRIDAMIENTO ULCERAS",
        "priceUsd": 150
      },
      {
        "name": "DENSITOMETRIA",
        "priceUsd": 35
      },
      {
        "name": "DEPURACION DE CREATININA",
        "priceUsd": 25
      },
      {
        "name": "DESHIDROGENASA DEL ACIDO LACTICO (LDH)",
        "priceUsd": 22
      },
      {
        "name": "DIGOXINA",
        "priceUsd": 35
      },
      {
        "name": "DILATACION DE PUNTOS LAGRIMALES + EXPLORACION DE VIAS LAGRIMAL",
        "priceUsd": 330
      },
      {
        "name": "DILATACION DE PUNTOS LAGRIMALES + EXPLORACION DE VIAS LAGRIMAL+ PLUG PERFORADO",
        "priceUsd": 430
      },
      {
        "name": "DILATACION DE PUNTOS LAGRIMALES + EXPLORACION DE VIAS LAGRIMAL+ PLVG PERFORADO (BILATERAL)",
        "priceUsd": 645
      },
      {
        "name": "DILATACIONES URETRALES CON ANESTESIA LOCAL",
        "priceUsd": 150
      },
      {
        "name": "DRENAJE DE ABSCESOS",
        "priceUsd": 150
      },
      {
        "name": "DRENAJE DE HEMATOMAS",
        "priceUsd": 100
      },
      {
        "name": "DRENAJE DE QUISTES PARPADOS",
        "priceUsd": 330
      },
      {
        "name": "DRENAJES DE ABSCESOS CON ANESTESIA LOCAL",
        "priceUsd": 85
      },
      {
        "name": "ECO 1ER TRIMESTRE",
        "priceUsd": 90
      },
      {
        "name": "ECO 1ER TRIMESTRE GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO 2DO TRIMESTRE",
        "priceUsd": 90
      },
      {
        "name": "ECO 2DO TRIMESTRE GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO 3D",
        "priceUsd": 90
      },
      {
        "name": "ECO 3D GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO 4D",
        "priceUsd": 90
      },
      {
        "name": "ECO 4D GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO ANEPLOIDIAS",
        "priceUsd": 90
      },
      {
        "name": "ECO ANEPLOIDIAS GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO CARDIOGRAMA",
        "priceUsd": 80
      },
      {
        "name": "ECO CARDIOGRAMA FETAL",
        "priceUsd": 90
      },
      {
        "name": "ECO CARDIOGRAMA FETAL GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO CON BURBUJAS",
        "priceUsd": 80
      },
      {
        "name": "ECO DE ESFUERZO",
        "priceUsd": 130
      },
      {
        "name": "ECO DOPPLER ABDOMINAL (HEPATICO, RENAL, PANCREATICO, GRANDES VASOS..)",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER ARTERIAL Y/O VENOSO DOS MIEMBROS",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER ARTERIAL Y/O VENOSO UN MIEMBRO",
        "priceUsd": 70
      },
      {
        "name": "ECO DOPPLER CARDIACO",
        "priceUsd": 90
      },
      {
        "name": "ECO DOPPLER CAROTIDEO",
        "priceUsd": 80
      },
      {
        "name": "ECO DOPPLER CEREBRAL",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER CUELLO (CAROTIDAS, TIROIDES..)",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER DE MAMA",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER DE PELVIS",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER GINECOLOGICO (ENDOMETRIO, OVARIOS..)",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER MATERNO FETAL",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER MATERNO FETAL GEMELAR",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER OBSTETRICO / PERFIL HEMODINAMICO MATERNO FETAL",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER PARTES BLANDAS",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER PROSTATICO",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER TESTICULAR",
        "priceUsd": 100
      },
      {
        "name": "ECO DOPPLER TRANSVAGINAL",
        "priceUsd": 100
      },
      {
        "name": "ECO GENETICO",
        "priceUsd": 90
      },
      {
        "name": "ECO GENETICO GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO MADUREZ FETAL",
        "priceUsd": 90
      },
      {
        "name": "ECO MADUREZ FETAL GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO MORFOLOGICO",
        "priceUsd": 90
      },
      {
        "name": "ECO MORFOLOGICO GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO PERFIL BIOFISICO",
        "priceUsd": 90
      },
      {
        "name": "ECO PERFIL BIOFISICO GEMELAR",
        "priceUsd": 120
      },
      {
        "name": "ECO PULMONAR",
        "priceUsd": 80
      },
      {
        "name": "ECO STRESS CON DOBUTAMINA",
        "priceUsd": 160
      },
      {
        "name": "ECO TRANSFONTANELAR",
        "priceUsd": 120
      },
      {
        "name": "ECOCARDIOGRAMA",
        "priceUsd": 90
      },
      {
        "name": "ECOGRAFIA PÉLVICA CON MEDICÓN DE VOLUMEN VESICAL PRE Y POST -MICCIONAL",
        "priceUsd": 60
      },
      {
        "name": "ECOGRAFIA PÉLVICA CON MEDICÓN DE VOLUMEN VESICAL PRE Y POST MICCIONAL + ECOGRAFIA PROSTATICA TRANSRECTAL",
        "priceUsd": 60
      },
      {
        "name": "ECOGRAFIA PROSTATICA TRANSRECTAL",
        "priceUsd": 80
      },
      {
        "name": "ECOGRAFIA RENAL",
        "priceUsd": 60
      },
      {
        "name": "ECOGRAFIA UROLOGICA (RIÑONES, VEJIGA CON MEDICION PRE Y POST MICCIONAL Y PROSTATA)",
        "priceUsd": 80
      },
      {
        "name": "ELECTROCARDIOGRAMA",
        "priceUsd": 20
      },
      {
        "name": "ELECTROCOAGULACIÓN / RADIOELECTROCIRUGIA (SESION)",
        "priceUsd": 180
      },
      {
        "name": "ELECTROENCEFALOGRAMA",
        "priceUsd": 70
      },
      {
        "name": "ELECTROFORESIS DE PROTEINAS",
        "priceUsd": 110
      },
      {
        "name": "ELECTRÓLISIS (SESION)",
        "priceUsd": 150
      },
      {
        "name": "ELECTROLITOS EN ORINA",
        "priceUsd": 35
      },
      {
        "name": "ESCLEROSIS DE ULCERA SANGRANTE",
        "priceUsd": 250
      },
      {
        "name": "ESCLEROSIS DE VARICES ESOFAGICAS",
        "priceUsd": 800
      },
      {
        "name": "ESTRADIOL",
        "priceUsd": 38
      },
      {
        "name": "EVALUACION CARDIOVASCULAR PRE-OPERATORIA",
        "priceUsd": 45
      },
      {
        "name": "EXERESIS DE LIPOMA SUPERFICIAL",
        "priceUsd": 400
      },
      {
        "name": "EXERESIS DE MUCOCELE SIMPLE",
        "priceUsd": 350
      },
      {
        "name": "EXTIRPACIÓN DE QUISTE (UNIDAD)",
        "priceUsd": 250
      },
      {
        "name": "EXTRACCION DE CUERPO EXTRAÑO",
        "priceUsd": 220
      },
      {
        "name": "EXTRACCION DE CUERPOS EXTRAÑOS EN LA ESFERA DEL ORL",
        "priceUsd": 85
      },
      {
        "name": "FACTOR REMATOIDEO (RA TEST)",
        "priceUsd": 27
      },
      {
        "name": "FERRITINA",
        "priceUsd": 75
      },
      {
        "name": "FIBRINOGENO",
        "priceUsd": 38
      },
      {
        "name": "FLUJOMETRIA URINARIA",
        "priceUsd": 80
      },
      {
        "name": "FLUJOMETRIA URINARIA + ECOGRAFIA PELVICA CON MEDICIÓN DEL VOLUMEN VESICAL PRE Y POST MICCIONAL",
        "priceUsd": 120
      },
      {
        "name": "FOSFATASA ACIDA",
        "priceUsd": 22
      },
      {
        "name": "FOSFATASA ACIDA PROSTATICA",
        "priceUsd": 22
      },
      {
        "name": "FOSFATASA ALCALINA (ALP)",
        "priceUsd": 22
      },
      {
        "name": "FOSFORO",
        "priceUsd": 22
      },
      {
        "name": "FOSFORO EN ORINA 24H",
        "priceUsd": 25
      },
      {
        "name": "FOSFORO EN ORINA PARCIAL",
        "priceUsd": 25
      },
      {
        "name": "FOSFORO EN SUERO",
        "priceUsd": 20
      },
      {
        "name": "FROTIS DE SANGRE PERIFERICA",
        "priceUsd": 22
      },
      {
        "name": "FUNCIONALISMO PULMONAR CON BRONCODILATACION (ESPIROMETRIA)",
        "priceUsd": 80
      },
      {
        "name": "GAMA GLUTAMIL TRANSPEPIDASA (GGT)",
        "priceUsd": 22
      },
      {
        "name": "GASTROSTOMIA ENDOSCOPICA PERCUTANEA",
        "priceUsd": 1600
      },
      {
        "name": "GLICEMIA EN AYUNAS",
        "priceUsd": 22
      },
      {
        "name": "GLICEMIA POST- PANDRIAL",
        "priceUsd": 22
      },
      {
        "name": "H.I.V.",
        "priceUsd": 30
      },
      {
        "name": "HECES",
        "priceUsd": 25
      },
      {
        "name": "HECES AZUCARES REDUCTORES",
        "priceUsd": 25
      },
      {
        "name": "HECES POR CONCENTRACION",
        "priceUsd": 18
      },
      {
        "name": "HECES SERIADO",
        "priceUsd": 22
      },
      {
        "name": "HELICOBACTER PYLORI",
        "priceUsd": 62
      },
      {
        "name": "HEMATOLOGIA COMPLETA",
        "priceUsd": 22
      },
      {
        "name": "HEMOGLOBINA GLICOSILADA",
        "priceUsd": 65
      },
      {
        "name": "HIERRO",
        "priceUsd": 22
      },
      {
        "name": "HIERRO SERICO",
        "priceUsd": 22
      },
      {
        "name": "HISTEROSCOPIA DIAGNOSTICA",
        "priceUsd": 380
      },
      {
        "name": "HISTEROSCOPIA OPERATORIA MAS BIOPSIA (INCLUYE ANATOMIA PATOLOGICA)",
        "priceUsd": 380
      },
      {
        "name": "HISTEROSCOPIA: POLIPECTOMIA O MIOMECTOMIA MAYOR DE 2CM",
        "priceUsd": 750
      },
      {
        "name": "HISTEROSCOPIA: POLIPECTOMIA O MIOMECTOMIA MENOR DE 2CM",
        "priceUsd": 600
      },
      {
        "name": "HOLTER DE ARRITMIA",
        "priceUsd": 100
      },
      {
        "name": "HOLTER DE PRESION (MAPA)",
        "priceUsd": 100
      },
      {
        "name": "HORMONA FOLICULOESTIMULANTE ( FSH )",
        "priceUsd": 37
      },
      {
        "name": "HORMONA LUTEINIZANTE (LH)",
        "priceUsd": 32
      },
      {
        "name": "HORMONAS TIROIDEAS (T3 LIBRE)",
        "priceUsd": 39
      },
      {
        "name": "HORMONAS TIROIDEAS (T4 LIBRE)",
        "priceUsd": 39
      },
      {
        "name": "HORMONAS TIROIDEAS (TSH)",
        "priceUsd": 39
      },
      {
        "name": "INFILTRACIÓN / ESCLEROSIS VÁRICES (Sesión)",
        "priceUsd": 150
      },
      {
        "name": "INFILTRACION 1 ARTICULACION",
        "priceUsd": 150
      },
      {
        "name": "INFILTRACION 2 o MAS ARTICULACIONES",
        "priceUsd": 250
      },
      {
        "name": "INFILTRACION DE 1 ESPOLON",
        "priceUsd": 150
      },
      {
        "name": "INMOVILIZACION Y RETIRO DE YESO (HONORARIOS)",
        "priceUsd": 100
      },
      {
        "name": "INMUNOGLOBULINA A ( IGA )",
        "priceUsd": 75
      },
      {
        "name": "INMUNOGLOBULINA A ( SALIVA )",
        "priceUsd": 75
      },
      {
        "name": "INMUNOGLOBULINA E ( IGE )",
        "priceUsd": 75
      },
      {
        "name": "INMUNOGLOBULINA G",
        "priceUsd": 75
      },
      {
        "name": "INMUNOGLOBULINA M",
        "priceUsd": 75
      },
      {
        "name": "INSULINA EN AYUNAS",
        "priceUsd": 74
      },
      {
        "name": "INSULINA POST- PANDRIAL",
        "priceUsd": 74
      },
      {
        "name": "LIBERACIÓN DE ADHERENCIAS BALANO PREPUCIALES",
        "priceUsd": 200
      },
      {
        "name": "LIBERACIÓN DE SINEQUIA SIMPLE",
        "priceUsd": 240
      },
      {
        "name": "LIGADURA DE VARICES ESOFAGICAS",
        "priceUsd": 800
      },
      {
        "name": "LIPASA",
        "priceUsd": 27
      },
      {
        "name": "MACHADO GUERREIRO ( MAL DE CHAGAS )",
        "priceUsd": 30
      },
      {
        "name": "MAGNESIO EN ORINA DE 24H",
        "priceUsd": 22
      },
      {
        "name": "MAGNESIO EN ORINA PARCIAL",
        "priceUsd": 22
      },
      {
        "name": "MAGNESIO EN SUERO",
        "priceUsd": 22
      },
      {
        "name": "MAMOGRAFIA BILATERAL",
        "priceUsd": 50
      },
      {
        "name": "MAMOGRAFIA UNILATERAL",
        "priceUsd": 38
      },
      {
        "name": "MICOPLASMA PNEUMONIAE ( IGA + IGG + IGM )",
        "priceUsd": 38
      },
      {
        "name": "MICROALBUMINURIA EN ORINA 24H",
        "priceUsd": 35
      },
      {
        "name": "MICROALBUMINURIA EN ORINA PARCIAL",
        "priceUsd": 35
      },
      {
        "name": "MIOGLOBINA",
        "priceUsd": 32
      },
      {
        "name": "MONO-TEST",
        "priceUsd": 18
      },
      {
        "name": "NEBULIZACIONES",
        "priceUsd": 30
      },
      {
        "name": "OCT SEGMENTO ANTERIOR Y POSTERIOR",
        "priceUsd": 100
      },
      {
        "name": "ORINA",
        "priceUsd": 22
      },
      {
        "name": "PANEL DE ALIMENTOS INHULANTES",
        "priceUsd": 160
      },
      {
        "name": "PAPILOGRAFIA",
        "priceUsd": 65
      },
      {
        "name": "PAQUIMETRIA DE CORNEA",
        "priceUsd": 60
      },
      {
        "name": "PARACENTESIS DIAGNOSTICA",
        "priceUsd": 200
      },
      {
        "name": "PERFIL 1 PREVISORA ( HC + GL + UR + CR + COL + TRIG )",
        "priceUsd": 45
      },
      {
        "name": "PERFIL 2 PREVISORA ( HC + GL + TRANS + BIL )",
        "priceUsd": 45
      },
      {
        "name": "PERFIL 20 ( HC+GL+UR+CR+COL+TRIG+AU+PROT+TRANS )",
        "priceUsd": 50
      },
      {
        "name": "PERFIL ALERGIA",
        "priceUsd": 85
      },
      {
        "name": "PERFIL DE ANEMIA",
        "priceUsd": 85
      },
      {
        "name": "PERFIL DE DIARREA",
        "priceUsd": 95
      },
      {
        "name": "PERFIL FERROC. o ANEM. I (HC+HIE+TRANSF+FERRIT)",
        "priceUsd": 75
      },
      {
        "name": "PERFIL FERROC. o ANEM. II (HC+HIE+TRANS+FERR+AC.FOL.+SAT.TRANS+VIT B12)",
        "priceUsd": 110
      },
      {
        "name": "PERFIL GENERAL",
        "priceUsd": 50
      },
      {
        "name": "PERFIL HEPATICO ( HC+PT PTT+LDH+F.A.+GGT+BIL+TRANS )",
        "priceUsd": 70
      },
      {
        "name": "PERFIL HORMONAL FEMENINO (FSH,LH,ESTRADIOL,PROLACTINA,PROGESTERONA,+ KIT EXTRACCION",
        "priceUsd": 70
      },
      {
        "name": "PERFIL HORMONAL MASCULINO (TESTOSTERONA,TESTOTERONALIBRE,PROLACTINA ,SHGB,PSA)+ KIT EXTRACION",
        "priceUsd": 70
      },
      {
        "name": "PERFIL ISQUEMICO (CK-CK MB-LDH- TROPONINA)+ KIT EXTRACCION)",
        "priceUsd": 50
      },
      {
        "name": "PERFIL LIPIDICO ( TRIG + COL + HDL + LDL + VLDL )",
        "priceUsd": 50
      },
      {
        "name": "PERFIL PEDIATRICO (HEMATOLOGIA COMPLETA, ORINA,HECES,GLICEMIA+KIT EXTRACCION",
        "priceUsd": 50
      },
      {
        "name": "PERFIL PREOPERATORIO ( HC+GL+UR+CR+HIV+VDRL+TIP+PT PTT )",
        "priceUsd": 70
      },
      {
        "name": "PERFIL RENAL ( HC+GL+UR+CR+PROT+ELECT+ORI+DEP CR Y PROT 24 )",
        "priceUsd": 60
      },
      {
        "name": "PERFIL REUMATICO ( HC + VSG + PCR + RA TEST + ASTO + A.U. )",
        "priceUsd": 90
      },
      {
        "name": "PERFIL TIROIDEO (TSH,T3 TOTAL,Y T4 TOTAL)+KIT EXTRACCION",
        "priceUsd": 50
      },
      {
        "name": "PLAQUETAS",
        "priceUsd": 22
      },
      {
        "name": "POLIPECTOMIA (1-3)",
        "priceUsd": 150
      },
      {
        "name": "POLIPECTOMIA (MÁS DE 3)",
        "priceUsd": 250
      },
      {
        "name": "POTASIO",
        "priceUsd": 30
      },
      {
        "name": "PROGESTERONA",
        "priceUsd": 47
      },
      {
        "name": "PROLACTINA",
        "priceUsd": 42
      },
      {
        "name": "PROTEINA C REACTIVA (CUALITATIVA Y/O CUANTITATIVA)",
        "priceUsd": 32
      },
      {
        "name": "PROTEINAS TOTALES Y FRACCIONADAS",
        "priceUsd": 22
      },
      {
        "name": "PROTEINURIA 24H",
        "priceUsd": 22
      },
      {
        "name": "PROTEINURIA EN ORINA PARCIAL 24H",
        "priceUsd": 22
      },
      {
        "name": "PRUEBA DE ERECCIÓN INDUCIDA CON INYECCIÓN INTRACAVENOSA DE SUSTANCIAS VASO ACTIVAS",
        "priceUsd": 90
      },
      {
        "name": "PRUEBA DE ESFUERZO",
        "priceUsd": 100
      },
      {
        "name": "PTERIGION",
        "priceUsd": 100
      },
      {
        "name": "PUNCIÓN CON AGUJA FINA",
        "priceUsd": 200
      },
      {
        "name": "PUNCIÓN LUMBAR",
        "priceUsd": 255
      },
      {
        "name": "RAFIA DE HERIDA SIMPLE",
        "priceUsd": 350
      },
      {
        "name": "REALIZACION DE BIOPSIA CON ANESTESIA LOCAL",
        "priceUsd": 85
      },
      {
        "name": "RECAMBIO DE SONDA FOLEY DE CISTOSTOMIA (INCLUYE MATERIAL)",
        "priceUsd": 200
      },
      {
        "name": "RECAMBIO DE SONDA FOLEY DE NEFROSTOMIA GUIA POR ECO (INCLUYE MATERIAL)",
        "priceUsd": 250
      },
      {
        "name": "REGISTRO BASICO DE RETINA (RBR)",
        "priceUsd": 60
      },
      {
        "name": "REMOCIÓN CUERPO EXTRAÑO CORNEAL",
        "priceUsd": 160
      },
      {
        "name": "RETICULOCITO",
        "priceUsd": 22
      },
      {
        "name": "RETIRO DE CATETER DOBLE J (ANESTESIA LOCAL)",
        "priceUsd": 250
      },
      {
        "name": "RMN ARTICULACION TEMPORO MANDIBULAR",
        "priceUsd": 300
      },
      {
        "name": "RMN CEREBRAL Y/O MULTIPLANAR",
        "priceUsd": 300
      },
      {
        "name": "RMN COXOFEMORAL CADERA DERECHA",
        "priceUsd": 300
      },
      {
        "name": "RMN COXOFEMORAL CADERA IZQUIERDA",
        "priceUsd": 300
      },
      {
        "name": "RMN DE ABDOMEN",
        "priceUsd": 350
      },
      {
        "name": "RMN DE ABDOMEN Y PELVIS",
        "priceUsd": 600
      },
      {
        "name": "RMN DE ANTEBRAZO DERECHO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE ANTEBRAZO IZQUIERDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE AXILA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE BRAZO DERECHO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE BRAZO IZQUIERDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE CODO DERECHO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE CODO IZQUIERDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE COLUMNA CERVICAL",
        "priceUsd": 350
      },
      {
        "name": "RMN DE COLUMNA DORSAL",
        "priceUsd": 300
      },
      {
        "name": "RMN DE COLUMNA LUMBAR",
        "priceUsd": 300
      },
      {
        "name": "RMN DE CUELLO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE FEMUR DERECHO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE FEMUR IZQUIERDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE HOMBRO DERECHO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE HOMBRO IZQUIERDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE MANO DERECHA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE MANO IZQUIERDA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE MUÑECA DERECHA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE MUÑECA IZQUIERDA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE MUSLO DERECHO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE MUSLO IZQUIERDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE OIDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE ORBITA",
        "priceUsd": 500
      },
      {
        "name": "RMN DE PANTORRILLA DERECHA",
        "priceUsd": 300
      },
      {
        "name": "RMN DE PANTORRILLA IZQUIERDA",
        "priceUsd": 300
      },
      {
        "name": "RMN DE PELVIS",
        "priceUsd": 600
      },
      {
        "name": "RMN DE PIE DERECHO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE PIE IZQUIERDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE PIERNA DERECHA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE PIERNA IZQUIERDA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE RODILLA DERECHA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE RODILLA IZQUIERDA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE SENOS PARANASALES",
        "priceUsd": 350
      },
      {
        "name": "RMN DE SILLA TURCA",
        "priceUsd": 350
      },
      {
        "name": "RMN DE TOBILLO DERECHO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE TOBILLO IZQUIERDO",
        "priceUsd": 350
      },
      {
        "name": "RMN DE TORAX",
        "priceUsd": 350
      },
      {
        "name": "RMN SACRO COCCIGEA",
        "priceUsd": 350
      },
      {
        "name": "RMN SACROILIACA",
        "priceUsd": 350
      },
      {
        "name": "ROTAVIRUS",
        "priceUsd": 29
      },
      {
        "name": "RUBEOLA ( IGG + IGM )",
        "priceUsd": 37
      },
      {
        "name": "RX CALCANEO O TALON DERECHO HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX CALCANEO O TALON IZQUIERDO HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX CAVUM, RINOFARINGE, WATERS HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX CISTOGRAFIA MICCIONAL (RX CON CONTRASTE)",
        "priceUsd": 58
      },
      {
        "name": "RX CLAVICULA DERECHA HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX CLAVICULA IZQUIERDA HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX CODO DERECHO HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX CODO IZQUIERDO HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX COLUMNA CERVICAL HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX COLUMNA DORSAL HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX COLUMNA DORSO - LUMBAR HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX COLUMNA LUMBAR HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX COLUMNA LUMBOSACRA HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX COXIS HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX CRANEO HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX CUELLO HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX DE ABDOMEN 1 PROYECCION",
        "priceUsd": 50
      },
      {
        "name": "RX DE ANTE BRAZO DERECHO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX DE ANTE BRAZO IZQUIERDO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX DE ARTICULACION COXOFEMORAL, CADERA DERECHA HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX DE ARTICULACION COXOFEMORAL, CADERA IZQUIERDA HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX DE ARTICULACION TEMPORO-MANDIBULAR HASTA (02) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX ESCAPULA DERECHA HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX ESCAPULA IZQUIERDA HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX ESTERNON (01) PROYECCION",
        "priceUsd": 55
      },
      {
        "name": "RX FEMUR DERECHO HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX FEMUR IZQUIERDO HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX HOMBRO DERECHO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX HOMBRO IZQUIERDO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX HUESOS PROPIOS DE LA NARIZ HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX HUMERO DERECHO HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX HUMERO IZQUIERDO HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX MANO Y FALANGES DERECHA HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX MANO Y FALANGES IZQUIERDA HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX ORBITA HASTA (02) PROYECCIONES",
        "priceUsd": 53
      },
      {
        "name": "RX PELVIS HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX PIE DERECHO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX PIE IZQUIERDO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX PIERNA DERECHO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX PIERNA IZQUIERDO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX RADIOCARPIANA Y MUÑECA DERECHA HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX RADIOCARPIANA Y MUÑECA IZQUIERDA HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX RODILLA DERECHA HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX RODILLA IZQUIERDA HASTA (06) PROYECCIONES",
        "priceUsd": 61
      },
      {
        "name": "RX ROTULA DERECHA HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX ROTULA IZQUIERDA HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX SACROXIS HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX SENOS PARANASALES HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX SERIE ESQUELOTICA HASTA (04) PROYECCIONES",
        "priceUsd": 57
      },
      {
        "name": "RX SILLA TURCA (01) PROYECCION",
        "priceUsd": 50
      },
      {
        "name": "RX TOBILLO DERECHA HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX TOBILLO IZQUIERDO HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX TORAX HASTA (03) PROYECCIONES",
        "priceUsd": 55
      },
      {
        "name": "RX TRANSITO GASTRO INTESTINAL (RX CON CONTRASTE)",
        "priceUsd": 58
      },
      {
        "name": "RX URETROCISTOGRAFIA MICCIONAL (RX CON CONTRASTE)",
        "priceUsd": 58
      },
      {
        "name": "RX URETROGRAFIA (RX CON CONTRASTE)",
        "priceUsd": 58
      },
      {
        "name": "RX UROGRAFIA DE ELIMINACION (RX CON CONTRATE)",
        "priceUsd": 58
      },
      {
        "name": "SANGRE OCULTA",
        "priceUsd": 22
      },
      {
        "name": "SATURACION DE TRASFERRINA",
        "priceUsd": 22
      },
      {
        "name": "SEROLOGIA CHLAMYDIA PNEUMONIAE ( IGG + IGM )",
        "priceUsd": 50
      },
      {
        "name": "SEROLOGIA CHLAMYDIA TRACHOMATIS ( IGA + IGG + IGM )",
        "priceUsd": 50
      },
      {
        "name": "SEROLOGIA HEPATITIS A ( IGG + IGM )",
        "priceUsd": 50
      },
      {
        "name": "SEROLOGIA HEPATITIS B ANTICORE",
        "priceUsd": 50
      },
      {
        "name": "SEROLOGIA HEPATITIS B ANTIGENO DE SUPERFICIE",
        "priceUsd": 27
      },
      {
        "name": "SEROLOGIA HEPATITIS B CORE IGG",
        "priceUsd": 50
      },
      {
        "name": "SEROLOGIA HEPATITIS B CORE IGM",
        "priceUsd": 50
      },
      {
        "name": "SEROLOGIA HEPATITIS B HBE",
        "priceUsd": 50
      },
      {
        "name": "SEROLOGIA HEPATITIS C",
        "priceUsd": 27
      },
      {
        "name": "SEROLOGIA PARA DENGUE BLOTT ( IGG + IGM )",
        "priceUsd": 27
      },
      {
        "name": "SEROLOGIA PARA EPSTEIN-BARR ( IGG + IGM )",
        "priceUsd": 37
      },
      {
        "name": "SODIO",
        "priceUsd": 22
      },
      {
        "name": "TAPONAMIENTO ANTERIOR NASAL BILATERAL",
        "priceUsd": 130
      },
      {
        "name": "TAPONAMIENTO ANTERIOR NASAL UNILATERAL",
        "priceUsd": 85
      },
      {
        "name": "TC ARTICULACION SACROILIACA",
        "priceUsd": 150
      },
      {
        "name": "TC CEREBRAL",
        "priceUsd": 150
      },
      {
        "name": "TC DE ABDOMEN",
        "priceUsd": 250
      },
      {
        "name": "TC DE ABDOMEN Y PELVIS",
        "priceUsd": 400
      },
      {
        "name": "TC DE ARTICULACION COXOFEMORAL Y CADERA DERECHA",
        "priceUsd": 150
      },
      {
        "name": "TC DE ARTICULACION COXOFEMORAL Y CADERA IZQUIERDA",
        "priceUsd": 150
      },
      {
        "name": "TC DE AXILA",
        "priceUsd": 150
      },
      {
        "name": "TC DE CODO DERECHO",
        "priceUsd": 150
      },
      {
        "name": "TC DE CODO IZQUIERDO",
        "priceUsd": 150
      },
      {
        "name": "TC DE COLUMNA CERVICAL",
        "priceUsd": 150
      },
      {
        "name": "TC DE COLUMNA DORSAL",
        "priceUsd": 150
      },
      {
        "name": "TC DE COLUMNA LUMBAR",
        "priceUsd": 150
      },
      {
        "name": "TC DE COLUMNA LUMBOSACRA",
        "priceUsd": 250
      },
      {
        "name": "TC DE COLUMNA SACRO COCCIGEA",
        "priceUsd": 250
      },
      {
        "name": "TC DE CRANEO",
        "priceUsd": 150
      },
      {
        "name": "TC DE CUELLO",
        "priceUsd": 250
      },
      {
        "name": "TC DE HOMBRO DERECHO",
        "priceUsd": 150
      },
      {
        "name": "TC DE HOMBRO IZQUIERDO",
        "priceUsd": 150
      },
      {
        "name": "TC DE MANO DERECHA",
        "priceUsd": 150
      },
      {
        "name": "TC DE MANO IZQUIERDA",
        "priceUsd": 150
      },
      {
        "name": "TC DE MUÑECA DERECHA",
        "priceUsd": 150
      },
      {
        "name": "TC DE MUÑECA IZQUIERDA",
        "priceUsd": 150
      },
      {
        "name": "TC DE MUSLO DERECHO",
        "priceUsd": 150
      },
      {
        "name": "TC DE MUSLO IZQUIERDO",
        "priceUsd": 150
      },
      {
        "name": "TC DE OIDO",
        "priceUsd": 150
      },
      {
        "name": "TC DE ORBITA",
        "priceUsd": 150
      },
      {
        "name": "TC DE PELVIS",
        "priceUsd": 150
      },
      {
        "name": "TC DE PIE DERECHO",
        "priceUsd": 150
      },
      {
        "name": "TC DE PIE IZQUIERDO",
        "priceUsd": 150
      },
      {
        "name": "TC DE RODILLA DERECHA",
        "priceUsd": 150
      },
      {
        "name": "TC DE RODILLA IZQUIERDA",
        "priceUsd": 150
      },
      {
        "name": "TC DE SENOS PARANASALES",
        "priceUsd": 150
      },
      {
        "name": "TC DE SILLA TURCA",
        "priceUsd": 150
      },
      {
        "name": "TC DE TOBILLO DERECHO",
        "priceUsd": 150
      },
      {
        "name": "TC DE TOBILLO IZQUIERDO",
        "priceUsd": 150
      },
      {
        "name": "TC DE TORAX",
        "priceUsd": 150
      },
      {
        "name": "TC DE VIAS RESPIRATORIAS",
        "priceUsd": 150
      },
      {
        "name": "TC MACIZO FACIAL Y/O ARTICULACION TEMPORO MANDIBULAR",
        "priceUsd": 150
      },
      {
        "name": "TC PROTOCOLO DE LITIASIS",
        "priceUsd": 150
      },
      {
        "name": "TELELARINGOSCOPIA",
        "priceUsd": 85
      },
      {
        "name": "TERAPIA CON ONDAS DE CHOQUE",
        "priceUsd": 250
      },
      {
        "name": "TESTOSTERONA LIBRE",
        "priceUsd": 27
      },
      {
        "name": "TESTOSTERONA TOTAL",
        "priceUsd": 35
      },
      {
        "name": "TIEMPO DE PROTOMBINA (TP)",
        "priceUsd": 22
      },
      {
        "name": "TIEMPO DE SANGRIA",
        "priceUsd": 22
      },
      {
        "name": "TIEMPO DE TROMBOPLASTINA PARCIAL (TTP)",
        "priceUsd": 22
      },
      {
        "name": "TIROGLOBULINA",
        "priceUsd": 47
      },
      {
        "name": "TOMA BIOPSIA DE NASAL",
        "priceUsd": 170
      },
      {
        "name": "TOMA DE BIOPSIA (Unidad)",
        "priceUsd": 80
      },
      {
        "name": "TOPOGRAFIA CORNEAL",
        "priceUsd": 75
      },
      {
        "name": "TOXOPLASMOSIS ( IGG + IGM )",
        "priceUsd": 37
      },
      {
        "name": "TRANSAMINASA GLUTAMICO OXALACETICA ( TGO / ALT )",
        "priceUsd": 22
      },
      {
        "name": "TRANSAMINASA GLUTAMICO PIRUVICA ( TGP / AST )",
        "priceUsd": 22
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 22
      },
      {
        "name": "TROPONINA I (cTnI)",
        "priceUsd": 29
      },
      {
        "name": "TROPONINA T (cTnT)",
        "priceUsd": 27
      },
      {
        "name": "ULTRASONIDO ABDOMINAL (HEPATICO, BILIAR, PANCREATICO, RENAL…)",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO CEREBRAL",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO DE CUELLO (TIROIDEO…)",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO DE PARTES BLANDAS",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO GINECOLOGICO",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO MAMARIO",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO OBSTETRICO",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO OBSTETRICO GEMELAR",
        "priceUsd": 80
      },
      {
        "name": "ULTRASONIDO OSTEO-MUSCULAR",
        "priceUsd": 150
      },
      {
        "name": "ULTRASONIDO PELVICO",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO PROSTATICO",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO REFLUJO",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO TESTICULAR",
        "priceUsd": 60
      },
      {
        "name": "ULTRASONIDO TRANSVAGINAL",
        "priceUsd": 60
      },
      {
        "name": "UREA EN ORINA DE 24H",
        "priceUsd": 22
      },
      {
        "name": "UREA EN ORINA PARCIAL",
        "priceUsd": 22
      },
      {
        "name": "URETROCISTOSCOPIA (ANESTESIA LOCAL)",
        "priceUsd": 350
      },
      {
        "name": "UROCULTIVO Y ANTIBIOGRAMA",
        "priceUsd": 32
      },
      {
        "name": "UROTAC",
        "priceUsd": 400
      },
      {
        "name": "VDRL",
        "priceUsd": 27
      },
      {
        "name": "VELOCIDAD DE SEDIMENTACION GLOBULAR ( V.S.G. )",
        "priceUsd": 22
      },
      {
        "name": "VIDEO COLONOSCOPIA(CONSULTA + ESTUDIO)",
        "priceUsd": 930
      },
      {
        "name": "VIDEO GASTROSCOPIA (CONSULTA + ESTUDIO)",
        "priceUsd": 880
      },
      {
        "name": "VIDEOENDOSCOPIA NASAL, LARINGEA Y OTICA RIGIDA Y NASOFIBROLARINGOSCOPIA",
        "priceUsd": 100
      },
      {
        "name": "VISCO SUPLEMENTACION UNILATERAL 1 SESION",
        "priceUsd": 170
      },
      {
        "name": "VITAMINA B12 o CIANOCOBALAMINA",
        "priceUsd": 35
      }
    ]
  },
  {
    "name": "SEGUROS ALTAMIRA, C.A",
    "aliases": [
      "Seguros Altamira"
    ],
    "rif": null,
    "services": [
      {
        "name": "ACIDO URICO",
        "priceUsd": 5
      },
      {
        "name": "ACIDO URICO EN ORINA 24 HORAS",
        "priceUsd": 5
      },
      {
        "name": "ACIDO URICO SERICO",
        "priceUsd": 25
      },
      {
        "name": "ALFA FETO PROTEINAS",
        "priceUsd": 26
      },
      {
        "name": "AMILASA",
        "priceUsd": 16
      },
      {
        "name": "AMILASA SERICA",
        "priceUsd": 16
      },
      {
        "name": "ANTI RUBEOLA IGG",
        "priceUsd": 28
      },
      {
        "name": "ANTI RUBEOLA IGM",
        "priceUsd": 28
      },
      {
        "name": "ANTI TOXOPLASMA IGG",
        "priceUsd": 12
      },
      {
        "name": "ANTI TOXOPLASMA IGM",
        "priceUsd": 15
      },
      {
        "name": "ANTIBIOGRAMA CON UROCULTIVO",
        "priceUsd": 47
      },
      {
        "name": "ANTICUERPOS ANTINUCLEARES ( ANA )",
        "priceUsd": 38
      },
      {
        "name": "BILIRRUBINA TOTAL",
        "priceUsd": 7
      },
      {
        "name": "BILIRRUBINA TOTAL Y F",
        "priceUsd": 10
      },
      {
        "name": "CALCIO",
        "priceUsd": 10
      },
      {
        "name": "CALCIO EN ORINA 24 HORAS",
        "priceUsd": 10
      },
      {
        "name": "CALCIO SERICO",
        "priceUsd": 10
      },
      {
        "name": "CITOLOGÍA VAGINAL",
        "priceUsd": 40
      },
      {
        "name": "CITOMEGALOVIRUS IGG",
        "priceUsd": 30
      },
      {
        "name": "CITOMEGALOVIRUS IGM",
        "priceUsd": 30
      },
      {
        "name": "CK-MB",
        "priceUsd": 25
      },
      {
        "name": "CLORO",
        "priceUsd": 6
      },
      {
        "name": "COLESTEROL",
        "priceUsd": 6
      },
      {
        "name": "COLESTEROL TOTAL Y SUS FRACCIONES",
        "priceUsd": 7.5
      },
      {
        "name": "CONSULTA: CARDIOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: CIRUGIA GENERAL",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: DERMATOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: ENDOCRINOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: GASTROENTEROLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: GINECOLOGIA OBSTETRICIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: MASTOLOGIA",
        "priceUsd": 70
      },
      {
        "name": "CONSULTA: MEDICINA GENERAL",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: MEDICINA INTERNA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: NEFROLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: NEUMONOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: NEUROCIRUGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: NEUROLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: NUTRICIONISTA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: OFTALMOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: ONCOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: OTORRINOLARINGOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: PEDIATRIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: REHABILITACION / FISIATRIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: REUMATOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: TRAUMATOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: UROLOGÍA",
        "priceUsd": 60
      },
      {
        "name": "COPROCULTIVO (CULTIVO DE LAS HECES)",
        "priceUsd": 49
      },
      {
        "name": "CPK",
        "priceUsd": 17
      },
      {
        "name": "CREATININA",
        "priceUsd": 5
      },
      {
        "name": "CULTIVO Y ANTIBIOGRAMA DE SECRECIÓN BRONQUIAL",
        "priceUsd": 47
      },
      {
        "name": "CURVA DE GLICEMIA INSULINA 3 HORAS CON 100GR DE GLUCOSA",
        "priceUsd": 57
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA 2 HRS CON 75 GRAMOS DE GLUCOSA",
        "priceUsd": 48.8
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA BASAL Y POSTPANDRIAL/2 HRS",
        "priceUsd": 41
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA CINCO HORAS",
        "priceUsd": 18
      },
      {
        "name": "DENGUE TEST",
        "priceUsd": 16
      },
      {
        "name": "DEPURACIÓN DE CREATININA Y PROTEINURIA EN ORINA DE 24 HRS",
        "priceUsd": 22
      },
      {
        "name": "ECO DOPPLER VENOSO DE MIEMBROS INFERIORES",
        "priceUsd": 90
      },
      {
        "name": "ECO PROSTATICO",
        "priceUsd": 40
      },
      {
        "name": "ECO-DOPPLER ARTERIAL DE MIEMBROS INFERIORES",
        "priceUsd": 90
      },
      {
        "name": "ECOSONOGRAMA ABDOMEN",
        "priceUsd": 45
      },
      {
        "name": "ECOSONOGRAMA ABDOMINO-PELVICO",
        "priceUsd": 50
      },
      {
        "name": "ECOSONOGRAMA DE PARTES BLANDAS",
        "priceUsd": 40
      },
      {
        "name": "ECOSONOGRAMA HEPATO-VESICULAR",
        "priceUsd": 40
      },
      {
        "name": "ECOSONOGRAMA MAMARIO",
        "priceUsd": 40
      },
      {
        "name": "ECOSONOGRAMA PELVICO",
        "priceUsd": 40
      },
      {
        "name": "ECOSONOGRAMA RENAL",
        "priceUsd": 40
      },
      {
        "name": "ECOSONOGRAMA TESTICULAR",
        "priceUsd": 40
      },
      {
        "name": "ECOSONOGRAMA TIROIDEO",
        "priceUsd": 40
      },
      {
        "name": "ECOSONOGRAMA TRANSVAGINAL",
        "priceUsd": 40
      },
      {
        "name": "ELECTROCARDIOGRAMA DE REPOSO",
        "priceUsd": 40
      },
      {
        "name": "ELECTROLITOS SÉRICOS (NA-K-CL). SODIO, POTASIO-CLORO",
        "priceUsd": 18
      },
      {
        "name": "EPSTEIN BARR VIRUS IGG",
        "priceUsd": 25
      },
      {
        "name": "EPSTEIN BARR VIRUS IGM",
        "priceUsd": 25
      },
      {
        "name": "ESPIROMETRÍA",
        "priceUsd": 70
      },
      {
        "name": "EVALUACION CARDIOVASCULAR PREOPERATORIA",
        "priceUsd": 70
      },
      {
        "name": "EXAMEN SERIADO DE HECES",
        "priceUsd": 14
      },
      {
        "name": "EXERESIS DE UN (2) NEVUS ACROCORDONES Y VERRUGAS",
        "priceUsd": 4
      },
      {
        "name": "FACTOR REUMATOIDEO",
        "priceUsd": 8.5
      },
      {
        "name": "FERRITINA",
        "priceUsd": 15
      },
      {
        "name": "FIBRINOGENO",
        "priceUsd": 7.8
      },
      {
        "name": "FOLATO",
        "priceUsd": 22
      },
      {
        "name": "FOSFATASA ALCALINA",
        "priceUsd": 6
      },
      {
        "name": "FOSFORO",
        "priceUsd": 8
      },
      {
        "name": "FOSFORO EN ORINA 24 HORAS",
        "priceUsd": 8
      },
      {
        "name": "GAMMAGLUTAMILTRANSPEPTIDASA (GGTP)",
        "priceUsd": 9
      },
      {
        "name": "GLICEMIA/GLUCOSA",
        "priceUsd": 5.1
      },
      {
        "name": "GRAM Y CULTIVO DE ESPUTO",
        "priceUsd": 92
      },
      {
        "name": "HB GLUCOSILADA. (HEMOGLOBINA GLUCOSILADA)",
        "priceUsd": 22
      },
      {
        "name": "HCG BETA (CUANTITATIVA)",
        "priceUsd": 16
      },
      {
        "name": "HCG BETA SUERO ( CUALITATIVA )",
        "priceUsd": 9.8
      },
      {
        "name": "HDL COLESTEROL",
        "priceUsd": 8
      },
      {
        "name": "HECES",
        "priceUsd": 5
      },
      {
        "name": "HELICOBACTER PÍLORY IGM",
        "priceUsd": 14
      },
      {
        "name": "HEMATOLOGÍA COMPLETA",
        "priceUsd": 7
      },
      {
        "name": "HEPATITIS A IgG . MARCADOR PARA HEPATITIS A",
        "priceUsd": 14
      },
      {
        "name": "HEPATITIS A IgM. MARCADOR PARA HEPATITIS A",
        "priceUsd": 14
      },
      {
        "name": "HEPATITIS B ANTI HbsAg. MARCADOR PARA HEPATITIS B",
        "priceUsd": 14
      },
      {
        "name": "HEPATITIS B ANTIGENO Hbe. HEPATITIS B",
        "priceUsd": 14
      },
      {
        "name": "HEPATITIS B CORE Hbc.HEPATITIS B",
        "priceUsd": 14
      },
      {
        "name": "HEPATITIS B CORE IgM.HEPATITIS B",
        "priceUsd": 14
      },
      {
        "name": "HEPATITIS B HbsAg. HEPATITIS B",
        "priceUsd": 14
      },
      {
        "name": "HEPATITIS C",
        "priceUsd": 12
      },
      {
        "name": "HIERRO SERICO",
        "priceUsd": 12
      },
      {
        "name": "HIV",
        "priceUsd": 9
      },
      {
        "name": "HOLTER DE ARRITMIA",
        "priceUsd": 90
      },
      {
        "name": "INFILTRACIÓN DE CUALQUIER ARTICULACION",
        "priceUsd": 220
      },
      {
        "name": "INMUNOGLOBULINA E (IGE)",
        "priceUsd": 16
      },
      {
        "name": "LDH",
        "priceUsd": 5.5
      },
      {
        "name": "LDL COLESTEROL",
        "priceUsd": 5.5
      },
      {
        "name": "MICROALBUMINURIA EN ORINA PARCIAL",
        "priceUsd": 19
      },
      {
        "name": "MONITOREO AMBULATORIO (HOLTER) DE LA PRESIÓN ARTERIAL ( MAPA)",
        "priceUsd": 90
      },
      {
        "name": "ORINA",
        "priceUsd": 5
      },
      {
        "name": "PEPTIDO CITRULINADO",
        "priceUsd": 31
      },
      {
        "name": "PERFIL 20",
        "priceUsd": 82
      },
      {
        "name": "PERFIL ANEMIA",
        "priceUsd": 74
      },
      {
        "name": "PERFIL CARDIACO",
        "priceUsd": 42
      },
      {
        "name": "PERFIL DE COAGULACION",
        "priceUsd": 17
      },
      {
        "name": "PERFIL GENERAL",
        "priceUsd": 61
      },
      {
        "name": "PERFIL GENERAL RIESGO",
        "priceUsd": 66
      },
      {
        "name": "PERFIL HEPATICO I",
        "priceUsd": 42
      },
      {
        "name": "PERFIL HEPATICO II",
        "priceUsd": 66
      },
      {
        "name": "PERFIL LIPIDICO",
        "priceUsd": 22
      },
      {
        "name": "PERFIL MÍNIMO",
        "priceUsd": 22.5
      },
      {
        "name": "PERFIL PRENATAL",
        "priceUsd": 66
      },
      {
        "name": "PERFIL PREOPERATORIO",
        "priceUsd": 54
      },
      {
        "name": "PERFIL REUMATOIDE I",
        "priceUsd": 25
      },
      {
        "name": "PERFIL REUMATOIDE II",
        "priceUsd": 25
      },
      {
        "name": "PERFIL TIROIDEO I",
        "priceUsd": 44
      },
      {
        "name": "PERFIL TIROIDEO II",
        "priceUsd": 44
      },
      {
        "name": "POTASIO",
        "priceUsd": 8.5
      },
      {
        "name": "PROTEINA C REACTIVA",
        "priceUsd": 9
      },
      {
        "name": "PROTEINA EN ORINA 24 HORAS",
        "priceUsd": 9
      },
      {
        "name": "PROTEINAS TOTALES Y FRACCIONADAS",
        "priceUsd": 8
      },
      {
        "name": "PROTEINURIA EN 24 HORAS",
        "priceUsd": 9.9
      },
      {
        "name": "PSA (Antígeno Prostático Específico)",
        "priceUsd": 32
      },
      {
        "name": "PT (Tiempo de Protrombina)",
        "priceUsd": 5
      },
      {
        "name": "SANGRE OCULTA EN HECES",
        "priceUsd": 6
      },
      {
        "name": "SESIONES DE FISIOTERAPIA",
        "priceUsd": 25
      },
      {
        "name": "SGOT",
        "priceUsd": 6.7
      },
      {
        "name": "SGPT",
        "priceUsd": 6.7
      },
      {
        "name": "SODIO",
        "priceUsd": 6
      },
      {
        "name": "T3",
        "priceUsd": 8.5
      },
      {
        "name": "T4 LIBRE",
        "priceUsd": 8.5
      },
      {
        "name": "T4 TOTAL",
        "priceUsd": 8.5
      },
      {
        "name": "TIEMPO DE COAGULACION",
        "priceUsd": 7
      },
      {
        "name": "TIEMPO DE PROTOMBINA ( TP )",
        "priceUsd": 6
      },
      {
        "name": "TIEMPO DE TROMBOPLASTINA PARCIAL ( PTT )",
        "priceUsd": 6
      },
      {
        "name": "TIROGLOBULINA",
        "priceUsd": 22
      },
      {
        "name": "TOMOGRAFIA ABDOMINO PELVICA CON CONTRASTE",
        "priceUsd": 250
      },
      {
        "name": "TOMOGRAFIA ABDOMINO PELVICA SIN CONTRASTE",
        "priceUsd": 180
      },
      {
        "name": "TOMOGRAFIA DE ABDOMEN CON CONTRASTE",
        "priceUsd": 220
      },
      {
        "name": "TOMOGRAFIA DE ABDOMEN SIN CONTRASTE",
        "priceUsd": 170
      },
      {
        "name": "TOMOGRAFIA DE COLUMNA CERVICAL",
        "priceUsd": 250
      },
      {
        "name": "TOMOGRAFIA DE COLUMNA DORSAL-",
        "priceUsd": 250
      },
      {
        "name": "TOMOGRAFIA DE COLUMNA LUMBOSACRA",
        "priceUsd": 250
      },
      {
        "name": "TOMOGRAFIA DE CRANEO CON CONTRASTE",
        "priceUsd": 250
      },
      {
        "name": "TOMOGRAFIA DE CRANEO SIN CONTRASTE",
        "priceUsd": 190
      },
      {
        "name": "TOMOGRAFIA DE CUELLO CON CONTRASTE",
        "priceUsd": 220
      },
      {
        "name": "TOMOGRAFIA DE CUELLO SIN CONTRASTE",
        "priceUsd": 170
      },
      {
        "name": "TOMOGRAFIA DE PELVIS CON CONTRASTE",
        "priceUsd": 240
      },
      {
        "name": "TOMOGRAFIA DE PELVIS SIN CONTRASTE",
        "priceUsd": 190
      },
      {
        "name": "TOMOGRAFIA DE SENOS PARANASALES",
        "priceUsd": 170
      },
      {
        "name": "TOMOGRAFIA DE TORAX CON CONTRASTE",
        "priceUsd": 220
      },
      {
        "name": "TOMOGRAFIA DE TORAX SIN CONTRASTE",
        "priceUsd": 170
      },
      {
        "name": "TRANSAMINASA GLUTAMICO PIRUVICA (TSGP)",
        "priceUsd": 6
      },
      {
        "name": "TRANSAMINASA OXALOACETICA (SGOT)",
        "priceUsd": 6
      },
      {
        "name": "TRANSFERRINA",
        "priceUsd": 18
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 6
      },
      {
        "name": "TSH EN DMT1",
        "priceUsd": 8.5
      },
      {
        "name": "UREA",
        "priceUsd": 5
      },
      {
        "name": "UREA-CREATININA.",
        "priceUsd": 10
      },
      {
        "name": "UROCULTIVO",
        "priceUsd": 45
      },
      {
        "name": "UROTOMOGRAFIA",
        "priceUsd": 180
      },
      {
        "name": "UROTOMOGRAFIA CON CONTRASTE",
        "priceUsd": 230
      },
      {
        "name": "VB12",
        "priceUsd": 22
      },
      {
        "name": "VDRL",
        "priceUsd": 5
      },
      {
        "name": "VELOCIDAD DE SEDIMENTACION GLOBULAR (VSG)",
        "priceUsd": 6
      },
      {
        "name": "VLDL COLESTEROL",
        "priceUsd": 8
      }
    ]
  },
  {
    "name": "Estar Seguros S.A",
    "aliases": [
      "Estar Seguros"
    ],
    "rif": null,
    "services": [
      {
        "name": "ACIDO URICO",
        "priceUsd": 2.5
      },
      {
        "name": "ACIDO URICO EN ORINA 24 HORAS",
        "priceUsd": 2.5
      },
      {
        "name": "ACIDO URICO SERICO",
        "priceUsd": 2.5
      },
      {
        "name": "ALFA FETO PROTEINAS",
        "priceUsd": 13
      },
      {
        "name": "AMILASA",
        "priceUsd": 7
      },
      {
        "name": "AMILASA SERICA",
        "priceUsd": 7
      },
      {
        "name": "ANTI TOXOPLASMA IGG",
        "priceUsd": 6
      },
      {
        "name": "ANTI TOXOPLASMA IGM",
        "priceUsd": 6
      },
      {
        "name": "ANTIBIOGRAMA",
        "priceUsd": 22.5
      },
      {
        "name": "ANTICUERPOS ANTI DNA",
        "priceUsd": 20
      },
      {
        "name": "ANTICUERPOS ANTITIROIDEOS",
        "priceUsd": 30
      },
      {
        "name": "BILIRRUBINA TOTAL",
        "priceUsd": 2
      },
      {
        "name": "BILIRRUBINA TOTAL Y F",
        "priceUsd": 3
      },
      {
        "name": "BIOPSIA",
        "priceUsd": 150
      },
      {
        "name": "C3",
        "priceUsd": 13
      },
      {
        "name": "C4",
        "priceUsd": 13
      },
      {
        "name": "CALCIO",
        "priceUsd": 5
      },
      {
        "name": "CALCIO EN ORINA 24 HORAS",
        "priceUsd": 5
      },
      {
        "name": "CALCIO SERICO",
        "priceUsd": 5
      },
      {
        "name": "CITOLOGÍA VAGINAL",
        "priceUsd": 20
      },
      {
        "name": "CITOMEGALOVIRUS IGG",
        "priceUsd": 8
      },
      {
        "name": "CITOMEGALOVIRUS IGM",
        "priceUsd": 8
      },
      {
        "name": "CK-MB",
        "priceUsd": 11
      },
      {
        "name": "CLORO",
        "priceUsd": 5
      },
      {
        "name": "COLESTEROL",
        "priceUsd": 3
      },
      {
        "name": "COLESTEROL TOTAL Y SUS FRACCIONES",
        "priceUsd": 12
      },
      {
        "name": "COLONOSCOPIA CON POLIPECTOMIA(EDI)",
        "priceUsd": 300
      },
      {
        "name": "COLONOSCOPIA SIN POLIPECTOMIA (EDI)",
        "priceUsd": 240
      },
      {
        "name": "COLPOSCOPA",
        "priceUsd": 150
      },
      {
        "name": "COLPOSCOPIA",
        "priceUsd": 50
      },
      {
        "name": "COMPLEMENTO SERICO C3-C4-CH50",
        "priceUsd": 44
      },
      {
        "name": "CONSULTA: CARDIOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: CIRUGIA GENERAL",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: DERMATOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: GASTROENTEROLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: GINECOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: MEDICINA GENERAL",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: MEDICINA INTERNA",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: NEFROLOGIA",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: NEUMONOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: NEUROLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: OTORRINOLARINGOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: PEDIATRIA",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: REHABILITACION / FISIATRIA",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: REUMATOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: TRAUMATOLOGIA",
        "priceUsd": 45
      },
      {
        "name": "COPROCULTIVO (CULTIVO DE LAS HECES)",
        "priceUsd": 25.2
      },
      {
        "name": "CPK",
        "priceUsd": 8
      },
      {
        "name": "CREATININA",
        "priceUsd": 2.5
      },
      {
        "name": "CULTIVO Y ANTIBIOGRAMA DE SECRECIÓN BRONQUIAL",
        "priceUsd": 22.5
      },
      {
        "name": "CURVA DE GLICEMIA INSULINA 3 HORAS CON 100GR DE GLUCOSA",
        "priceUsd": 44
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA 2 HRS CON 75 GRAMOS DE GLUCOSA",
        "priceUsd": 35
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA BASAL Y POSTPANDRIAL/2 HRS",
        "priceUsd": 27
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA CINCO HORAS",
        "priceUsd": 54
      },
      {
        "name": "DENGUE TEST",
        "priceUsd": 8
      },
      {
        "name": "DEPURACIÓN DE CREATININA Y PROTEINURIA EN ORINA DE 24 HRS",
        "priceUsd": 12
      },
      {
        "name": "ECO DOPPLER VENOSO DE MIEMBROS INFERIORES",
        "priceUsd": 90
      },
      {
        "name": "ECO PROSTATICO",
        "priceUsd": 30
      },
      {
        "name": "ECO-DOPPLER ARTERIAL DE MIEMBROS INFERIORES",
        "priceUsd": 90
      },
      {
        "name": "ECO-DOPPLER CAROTIDEO",
        "priceUsd": 90
      },
      {
        "name": "ECOCARDIOGRAMA DOPLER CARDIACO",
        "priceUsd": 100
      },
      {
        "name": "ECOGRAFIA OCULAR",
        "priceUsd": 50
      },
      {
        "name": "ECOSONOGRAMA ABDOMEN",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA ABDOMINO-PELVICO",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA DE PARTES BLANDAS",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA HEPATO-VESICULAR",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA MAMARIO",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA OBSTETRICO",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA PELVICO",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA RENAL",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA TESTICULAR",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA TIROIDEO",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA TRANSVAGINAL",
        "priceUsd": 30
      },
      {
        "name": "ECOSONOGRAMA VESICAL",
        "priceUsd": 30
      },
      {
        "name": "ELECTROCARDIOGRAMA DE REPOSO",
        "priceUsd": 20
      },
      {
        "name": "ELECTROENCEFALOGRAMA",
        "priceUsd": 100
      },
      {
        "name": "ELECTROLITOS SÉRICOS (NA-K-CL). SODIO, POTASIO-CLORO",
        "priceUsd": 13.5
      },
      {
        "name": "ENDOSCOPIA DIGESTIVA SUPERIOR (EDS)",
        "priceUsd": 220
      },
      {
        "name": "EPSTEIN BARR VIRUS IGG",
        "priceUsd": 11
      },
      {
        "name": "EPSTEIN BARR VIRUS IGM",
        "priceUsd": 11
      },
      {
        "name": "ESPIROMETRIA",
        "priceUsd": 70
      },
      {
        "name": "EVALUACION CARDIOVASCULAR PREOPERATORIA",
        "priceUsd": 60
      },
      {
        "name": "EXAMEN SERIADO DE HECES",
        "priceUsd": 10.5
      },
      {
        "name": "EXTRACCION DE CUERPOS EXTRAÑOS",
        "priceUsd": 60
      },
      {
        "name": "FACTOR REUMATOIDEO",
        "priceUsd": 5
      },
      {
        "name": "FERRITINA",
        "priceUsd": 10
      },
      {
        "name": "FIBRINOGENO",
        "priceUsd": 5.5
      },
      {
        "name": "FOLATO",
        "priceUsd": 16
      },
      {
        "name": "FOSFATASA ALCALINA",
        "priceUsd": 4.5
      },
      {
        "name": "FOSFORO",
        "priceUsd": 5
      },
      {
        "name": "FOSFORO EN ORINA 24 HORAS",
        "priceUsd": 5
      },
      {
        "name": "GAMMAGLUTAMILTRANSPEPTIDASA (GGTP)",
        "priceUsd": 7
      },
      {
        "name": "GLICEMIA/GLUCOSA",
        "priceUsd": 2.5
      },
      {
        "name": "HB GLUCOSILADA. (HEMOGLOBINA GLUCOSILADA)",
        "priceUsd": 16
      },
      {
        "name": "HCG BETA (CUANTITATIVA)",
        "priceUsd": 10
      },
      {
        "name": "HCG BETA SUERO ( CUALITATIVA )",
        "priceUsd": 5
      },
      {
        "name": "HDL COLESTEROL",
        "priceUsd": 3
      },
      {
        "name": "HECES",
        "priceUsd": 3.5
      },
      {
        "name": "HELICOBACTER PÍLORY IGM",
        "priceUsd": 6
      },
      {
        "name": "HEMATOLOGÍA COMPLETA",
        "priceUsd": 4.4
      },
      {
        "name": "HEPATITIS A IgG . MARCADOR PARA HEPATITIS A",
        "priceUsd": 9
      },
      {
        "name": "HEPATITIS A IgM. MARCADOR PARA HEPATITIS A",
        "priceUsd": 9
      },
      {
        "name": "HEPATITIS B ANTI HbsAg. MARCADOR PARA HEPATITIS B",
        "priceUsd": 9
      },
      {
        "name": "HEPATITIS B ANTIGENO Hbe. HEPATITIS B",
        "priceUsd": 9
      },
      {
        "name": "HEPATITIS B CORE Hbc.HEPATITIS B",
        "priceUsd": 9
      },
      {
        "name": "HEPATITIS B CORE IgM.HEPATITIS B",
        "priceUsd": 9
      },
      {
        "name": "HEPATITIS B HbsAg. HEPATITIS B",
        "priceUsd": 9
      },
      {
        "name": "HEPATITIS C",
        "priceUsd": 9
      },
      {
        "name": "HIERRO SERICO",
        "priceUsd": 7
      },
      {
        "name": "HIV",
        "priceUsd": 4.5
      },
      {
        "name": "HOLTER DE ARRITMIA",
        "priceUsd": 100
      },
      {
        "name": "INFILTRACIÓN DE CUALQUIER ARTICULACION",
        "priceUsd": 120
      },
      {
        "name": "INFILTRACIONES EN TRAUMATOLOGIA",
        "priceUsd": 100
      },
      {
        "name": "INMOVILIZACION FELULA MIEMBROS INF",
        "priceUsd": 80
      },
      {
        "name": "INMOVILIZACION FELULA MIEMBROS SUP",
        "priceUsd": 60
      },
      {
        "name": "INMOVILIZACIÓN FUNCIONAL",
        "priceUsd": 80
      },
      {
        "name": "INMOVILIZACION YESOS MIEMBROS INF",
        "priceUsd": 100
      },
      {
        "name": "INMOVILIZACION YESOS MIEMBROS SUP",
        "priceUsd": 80
      },
      {
        "name": "INMUNOGLOBULINA A (IGA)",
        "priceUsd": 10
      },
      {
        "name": "INMUNOGLOBULINA E (IGE)",
        "priceUsd": 10
      },
      {
        "name": "INMUNOGLOBULINA G (IGG)",
        "priceUsd": 10
      },
      {
        "name": "INMUNOGLOBULINA M (IGM)",
        "priceUsd": 10
      },
      {
        "name": "LDH",
        "priceUsd": 3.5
      },
      {
        "name": "LDL COLESTEROL",
        "priceUsd": 3
      },
      {
        "name": "LIMPIEZA INTRUMENTAL DE OIDO",
        "priceUsd": 40
      },
      {
        "name": "MARCADORES VIRALES PARA HEPATITIS C",
        "priceUsd": 9
      },
      {
        "name": "MICROALBUMINURIA EN ORINA PARCIAL",
        "priceUsd": 10
      },
      {
        "name": "MONITOREO AMBULATORIO (HOLTER) DE LA PRESIÓN ARTERIAL ( MAPA)",
        "priceUsd": 100
      },
      {
        "name": "ORINA",
        "priceUsd": 3.5
      },
      {
        "name": "PERFIL 20",
        "priceUsd": 52.4
      },
      {
        "name": "PERFIL ANEMIA",
        "priceUsd": 31.4
      },
      {
        "name": "PERFIL DE COAGULACION",
        "priceUsd": 7
      },
      {
        "name": "PERFIL GENERAL",
        "priceUsd": 43.4
      },
      {
        "name": "PERFIL HEPATICO I",
        "priceUsd": 18.5
      },
      {
        "name": "PERFIL LIPIDICO",
        "priceUsd": 12
      },
      {
        "name": "PERFIL LITIASICO",
        "priceUsd": 5
      },
      {
        "name": "PERFIL PRENATAL",
        "priceUsd": 31.4
      },
      {
        "name": "PERFIL PREOPERATORIO",
        "priceUsd": 30.4
      },
      {
        "name": "PERFIL REUMATOIDE I",
        "priceUsd": 10
      },
      {
        "name": "PERFIL TIROIDEO I",
        "priceUsd": 24
      },
      {
        "name": "PERFIL TIROIDEO II",
        "priceUsd": 27
      },
      {
        "name": "POTASIO",
        "priceUsd": 5
      },
      {
        "name": "PROLACTINA SERICA",
        "priceUsd": 10
      },
      {
        "name": "PROTEINA C REACTIVA",
        "priceUsd": 5
      },
      {
        "name": "PROTEINA EN ORINA 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "PROTEINAS TOTALES Y FRACCIONADAS",
        "priceUsd": 3.5
      },
      {
        "name": "PROTEINURIA EN 24 HORAS",
        "priceUsd": 7
      },
      {
        "name": "PSA (Antígeno Prostático Específico)",
        "priceUsd": 18
      },
      {
        "name": "PT (Tiempo de Protrombina)",
        "priceUsd": 3.5
      },
      {
        "name": "RETIRO DE PUNTOS",
        "priceUsd": 30
      },
      {
        "name": "SANGRE OCULTA EN HECES",
        "priceUsd": 5.5
      },
      {
        "name": "SESIONES DE FISIOTERAPIA 5 SESIONES",
        "priceUsd": 100
      },
      {
        "name": "SESIONES DE FISIOTERAPIA CADA UNO",
        "priceUsd": 20
      },
      {
        "name": "SGOT",
        "priceUsd": 3.5
      },
      {
        "name": "SGPT",
        "priceUsd": 3.5
      },
      {
        "name": "SODIO",
        "priceUsd": 4.5
      },
      {
        "name": "T3",
        "priceUsd": 9
      },
      {
        "name": "T4 LIBRE",
        "priceUsd": 9
      },
      {
        "name": "T4 TOTAL",
        "priceUsd": 9
      },
      {
        "name": "TIEMPO DE COAGULACION",
        "priceUsd": 7
      },
      {
        "name": "TIEMPO DE PROTOMBINA ( TP )",
        "priceUsd": 3.5
      },
      {
        "name": "TIEMPO DE TROMBOPLASTINA PARCIAL ( PTT )",
        "priceUsd": 3.5
      },
      {
        "name": "TIROGLOBULINA",
        "priceUsd": 13
      },
      {
        "name": "TITULOS DE ANTIESTREPTOLISINA (ASTO)",
        "priceUsd": 4.5
      },
      {
        "name": "TRANSAMINASA GLUTAMICO PIRUVICA (TSGP)",
        "priceUsd": 3.5
      },
      {
        "name": "TRANSAMINASA OXALOACETICA (SGOT)",
        "priceUsd": 3.5
      },
      {
        "name": "TRANSFERRINA",
        "priceUsd": 10
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 3.5
      },
      {
        "name": "TSH EN DMT1",
        "priceUsd": 9
      },
      {
        "name": "UREA",
        "priceUsd": 2.5
      },
      {
        "name": "UREA-CREATININA.",
        "priceUsd": 5
      },
      {
        "name": "UROCULTIVO",
        "priceUsd": 22.5
      },
      {
        "name": "VB12",
        "priceUsd": 16
      },
      {
        "name": "VDRL",
        "priceUsd": 3.5
      },
      {
        "name": "VELOCIDAD DE SEDIMENTACION GLOBULAR (VSG)",
        "priceUsd": 3
      },
      {
        "name": "VLDL COLESTEROL",
        "priceUsd": 3
      }
    ]
  },
  {
    "name": "SEGUROS CONSTITUCION, C.A",
    "aliases": [
      "Seguros Constitución"
    ],
    "rif": null,
    "services": [
      {
        "name": "17 OH PROGESTERONA",
        "priceUsd": 16
      },
      {
        "name": "A.S.T.O. (TÍTULO DE ANTIESTREPTOLISINA)",
        "priceUsd": 5.5
      },
      {
        "name": "ACIDO URICO ORINA 24 HORAS",
        "priceUsd": 4.69
      },
      {
        "name": "ACIDO URICO ORINA PARCIAL",
        "priceUsd": 3.4
      },
      {
        "name": "ACIDO URICO SERICO",
        "priceUsd": 4.69
      },
      {
        "name": "ADENOVIRUS",
        "priceUsd": 13
      },
      {
        "name": "ADENOVIRUS IgG",
        "priceUsd": 13
      },
      {
        "name": "ADENOVIRUS IgM",
        "priceUsd": 13
      },
      {
        "name": "ALBUMINA O 24 HORA",
        "priceUsd": 5.5
      },
      {
        "name": "ALBUMINA ORINA PARCIAL",
        "priceUsd": 5.5
      },
      {
        "name": "ALBUMINA/S",
        "priceUsd": 5.5
      },
      {
        "name": "ALFAFETOPROTEINA",
        "priceUsd": 21.7
      },
      {
        "name": "AMILASA ORINA PARCIAL",
        "priceUsd": 6
      },
      {
        "name": "AMILASA SERICA",
        "priceUsd": 8
      },
      {
        "name": "ANTICUERPOS ANTITIROID",
        "priceUsd": 47.8
      },
      {
        "name": "AZUCARES REDUCTORES",
        "priceUsd": 7
      },
      {
        "name": "BILIRRUBINA TOTAL Y FRACCIONADA",
        "priceUsd": 8
      },
      {
        "name": "BK DE ESPUTO",
        "priceUsd": 15
      },
      {
        "name": "BORDETELLA PERTUSIS IgG",
        "priceUsd": 14
      },
      {
        "name": "BORDETELLA PERTUSIS IgM",
        "priceUsd": 14
      },
      {
        "name": "BORRELIA IgG",
        "priceUsd": 14
      },
      {
        "name": "BORRELIA IgM",
        "priceUsd": 14
      },
      {
        "name": "BRUCELLA ABORTUS IgG",
        "priceUsd": 14
      },
      {
        "name": "BRUCELLA ABORTUS IgM",
        "priceUsd": 14
      },
      {
        "name": "BUN",
        "priceUsd": 3.6
      },
      {
        "name": "C.A 125 OVARIO",
        "priceUsd": 15
      },
      {
        "name": "C.A 19.9 DIGES",
        "priceUsd": 15
      },
      {
        "name": "C.A. 15.3 MAMA",
        "priceUsd": 15
      },
      {
        "name": "C.E.A ANTÍGENO CARCIGENOEMBRIONARIO",
        "priceUsd": 12
      },
      {
        "name": "C.K.M.B",
        "priceUsd": 16
      },
      {
        "name": "C.P.K.M.M",
        "priceUsd": 12
      },
      {
        "name": "C1 INHIBIDOR",
        "priceUsd": 12
      },
      {
        "name": "C3 (Complemento 3)",
        "priceUsd": 16
      },
      {
        "name": "C4 (Complemento 4)",
        "priceUsd": 16
      },
      {
        "name": "CALCIO ORINA 24 HORAS",
        "priceUsd": 8
      },
      {
        "name": "CALCIO ORINA PARCIAL",
        "priceUsd": 6
      },
      {
        "name": "CALCIO SERICO",
        "priceUsd": 8
      },
      {
        "name": "CARGA GLICOSILADA",
        "priceUsd": 13
      },
      {
        "name": "CITOGRAMA DE MOCO NASAL",
        "priceUsd": 6
      },
      {
        "name": "CITOMEGALOVIRUS IgG",
        "priceUsd": 14
      },
      {
        "name": "CITOMEGALOVIRUS IgM",
        "priceUsd": 14
      },
      {
        "name": "CLAMIDEA TRACHOMATIS IgM",
        "priceUsd": 15
      },
      {
        "name": "CLORO ORINA 24HORA",
        "priceUsd": 5.5
      },
      {
        "name": "CLORO ORINA PARCIAL",
        "priceUsd": 5.5
      },
      {
        "name": "CLORO SERICO",
        "priceUsd": 5.5
      },
      {
        "name": "COCAINA O",
        "priceUsd": 7
      },
      {
        "name": "COLESTEROL TOTAL",
        "priceUsd": 3.2
      },
      {
        "name": "CONSULTA: CARDIOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: CIRUGIA GENERAL",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: ENDOCRINOLOGIA",
        "priceUsd": 40
      },
      {
        "name": "CONSULTA: FISIATRIA",
        "priceUsd": 35
      },
      {
        "name": "CONSULTA: GINECOLOGIA",
        "priceUsd": 40
      },
      {
        "name": "CONSULTA: MASTOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: MEDICINA FAMILIAR",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: MEDICINA GENERAL",
        "priceUsd": 25
      },
      {
        "name": "CONSULTA: MEDICINA INTERNA",
        "priceUsd": 35
      },
      {
        "name": "CONSULTA: NEFROLOGIA",
        "priceUsd": 40
      },
      {
        "name": "CONSULTA: ONCOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: OTORRINOLARINGOLOGIA",
        "priceUsd": 40
      },
      {
        "name": "CONSULTA: PEDIATRIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: REUMATOLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: TRAUMATOLOGIA",
        "priceUsd": 35
      },
      {
        "name": "CONSULTA: UROLOGÍA",
        "priceUsd": 50
      },
      {
        "name": "CONTAJE DE EOSINOFILOS",
        "priceUsd": 3.5
      },
      {
        "name": "CONTAJE DE MONOCITOS",
        "priceUsd": 3.5
      },
      {
        "name": "CONTAJE DE PLAQUETAS( METODO MANUAL)",
        "priceUsd": 3.5
      },
      {
        "name": "CONTAJE DE RETICULOCITOS",
        "priceUsd": 3.5
      },
      {
        "name": "COPROCULTIVO",
        "priceUsd": 42
      },
      {
        "name": "CORTISOL (4pm)",
        "priceUsd": 14
      },
      {
        "name": "CORTISOL BASAL(8 am)",
        "priceUsd": 14
      },
      {
        "name": "CORTISOL LIBRE URINARIO 24 H",
        "priceUsd": 14
      },
      {
        "name": "CORTISOL URINARIO",
        "priceUsd": 14
      },
      {
        "name": "CREATININA EN ORINA PARCIAL",
        "priceUsd": 3.6
      },
      {
        "name": "CREATININA ORINA 24 HORAS:",
        "priceUsd": 3.6
      },
      {
        "name": "CREATININA SERICA",
        "priceUsd": 3.6
      },
      {
        "name": "CULTIVO Y ANTIBIOGRAMA",
        "priceUsd": 38.8
      },
      {
        "name": "DENGUE BLOT",
        "priceUsd": 7
      },
      {
        "name": "DENGUE IgG",
        "priceUsd": 7
      },
      {
        "name": "DENGUE IgG/ IgM",
        "priceUsd": 7
      },
      {
        "name": "DENGUE IgM",
        "priceUsd": 7
      },
      {
        "name": "DESHIDROGENASA LACTICA (L.D.H)",
        "priceUsd": 7
      },
      {
        "name": "DIMERO D",
        "priceUsd": 25.5
      },
      {
        "name": "ELECTROCARDIOGRAMA",
        "priceUsd": 30
      },
      {
        "name": "ELECTROLITOS SERICOS(k+,Na+,Cloro,Fosf,Mag)",
        "priceUsd": 12
      },
      {
        "name": "EPSTEIN BAR IgG",
        "priceUsd": 19.3
      },
      {
        "name": "EPSTEIN BAR IgM",
        "priceUsd": 19.3
      },
      {
        "name": "ESPIROMETRIA",
        "priceUsd": 60
      },
      {
        "name": "ESTRADIOL",
        "priceUsd": 15
      },
      {
        "name": "EXUDADO FARINGEO",
        "priceUsd": 35
      },
      {
        "name": "F.S.H.",
        "priceUsd": 10
      },
      {
        "name": "FERRITINA",
        "priceUsd": 16
      },
      {
        "name": "FIBRINOGENO",
        "priceUsd": 10
      },
      {
        "name": "FOSFATASA ACIDA TOTAL",
        "priceUsd": 7
      },
      {
        "name": "FOSFATASA ALCALINA",
        "priceUsd": 7
      },
      {
        "name": "FOSFORO ORINA PARCIAL",
        "priceUsd": 6.5
      },
      {
        "name": "FOSFORO SERICO",
        "priceUsd": 6.5
      },
      {
        "name": "FOSFORO/ORINA 24 HORA",
        "priceUsd": 6.5
      },
      {
        "name": "FROTIS DE SANGRE PERIFERICA",
        "priceUsd": 4.5
      },
      {
        "name": "GASTROENTEROLOGIA + ECO",
        "priceUsd": 45
      },
      {
        "name": "GIARDIA LAMBIA",
        "priceUsd": 4.5
      },
      {
        "name": "GLICEMIA EN AYUNAS",
        "priceUsd": 3
      },
      {
        "name": "GLICEMIA POST CARGA 100 grs 1 HORA",
        "priceUsd": 12
      },
      {
        "name": "GLICEMIA POST CARGA 100 grs 2 HORA",
        "priceUsd": 14
      },
      {
        "name": "GLICEMIA POST CARGA 50 grs 1 HORA",
        "priceUsd": 12
      },
      {
        "name": "GLICEMIA POST- CARGA 50 grs 2 H",
        "priceUsd": 14
      },
      {
        "name": "GLICEMIA POST- PANDRIAL 2 HORAS",
        "priceUsd": 8
      },
      {
        "name": "GLICEMIA POST-CARGA 75 grs 2 HORAS",
        "priceUsd": 8
      },
      {
        "name": "GLICEMIA POST-PANDRIAL 1 HORA",
        "priceUsd": 8
      },
      {
        "name": "GLICEMIA POST-PANDRIAL 3 HORAS",
        "priceUsd": 8
      },
      {
        "name": "GOTA GRUESA",
        "priceUsd": 6
      },
      {
        "name": "GRUPO SANGUÍNEO Y FACTOR RH",
        "priceUsd": 5
      },
      {
        "name": "H.C.G CUANTITATIVA",
        "priceUsd": 20
      },
      {
        "name": "H.D.L COLESTEROL",
        "priceUsd": 5
      },
      {
        "name": "HbA HEMOG GLICOSILADA TOTAL",
        "priceUsd": 10
      },
      {
        "name": "HECES",
        "priceUsd": 4.9
      },
      {
        "name": "HELICOBACTER PILORY IgG",
        "priceUsd": 10
      },
      {
        "name": "HELICOBACTER PILORY IgM",
        "priceUsd": 11
      },
      {
        "name": "HELICOBACTER PYLORI EN HECES",
        "priceUsd": 12
      },
      {
        "name": "HELICOBACTER PYLORI TOTAL",
        "priceUsd": 10
      },
      {
        "name": "HEMATOLOGIA COMPLETA/PLAQUETAS",
        "priceUsd": 5
      },
      {
        "name": "HEMOGLOBINA",
        "priceUsd": 3
      },
      {
        "name": "HEMOGLOBINA GLICOSILADA (HbA1C)",
        "priceUsd": 16
      },
      {
        "name": "HEPATITIS \"B\" ANTI -CORE( HBcAb)",
        "priceUsd": 5.5
      },
      {
        "name": "HEPATITIS \"B\" ANTI CORE I.g.M",
        "priceUsd": 5.5
      },
      {
        "name": "HEPATITIS \"B\" ANTI CORE IgG",
        "priceUsd": 5.5
      },
      {
        "name": "HEPATITIS \"B\" ANTÍGENO DE SUPERFICIE( HBsAg)",
        "priceUsd": 11
      },
      {
        "name": "HEPATITIS \"C\"",
        "priceUsd": 11
      },
      {
        "name": "HEPATITIS A IgG",
        "priceUsd": 15
      },
      {
        "name": "HEPATITIS A IgM",
        "priceUsd": 11
      },
      {
        "name": "HEPATITIS C IgG",
        "priceUsd": 5.5
      },
      {
        "name": "HEPATITIS C IgM",
        "priceUsd": 5.5
      },
      {
        "name": "HERPEX SIMPLE IgG",
        "priceUsd": 10
      },
      {
        "name": "HERPEX SIMPLE IgM",
        "priceUsd": 10
      },
      {
        "name": "HIERRO SERICO",
        "priceUsd": 10
      },
      {
        "name": "HIV",
        "priceUsd": 10
      },
      {
        "name": "INDICE CALCIO O/CREATININA O",
        "priceUsd": 8
      },
      {
        "name": "INDICE FOSFOR O/CREATININA O",
        "priceUsd": 8
      },
      {
        "name": "INDICE LDH/HDL",
        "priceUsd": 8
      },
      {
        "name": "INDICE MAG/CREAT",
        "priceUsd": 8
      },
      {
        "name": "INDICE UREA/CRETININA",
        "priceUsd": 8
      },
      {
        "name": "INSULINA BASAL",
        "priceUsd": 13
      },
      {
        "name": "INSULINA POST CAGRA 75 grs 1 HORA",
        "priceUsd": 10
      },
      {
        "name": "INSULINA POST CARGA 100 grs 2 HORA",
        "priceUsd": 10
      },
      {
        "name": "INSULINA POST CARGA 50 grs 1 HORA",
        "priceUsd": 10
      },
      {
        "name": "INSULINA POST CARGA 50 grs 2 HORAS",
        "priceUsd": 10
      },
      {
        "name": "INSULINA POST- CARGA 75 grs 2 HORAS",
        "priceUsd": 10
      },
      {
        "name": "INSULINA POST- PANDRIAL 1 HORA",
        "priceUsd": 10
      },
      {
        "name": "INSULINA POST- PANDRIAL 2 HORAS",
        "priceUsd": 10
      },
      {
        "name": "L.H.",
        "priceUsd": 15
      },
      {
        "name": "LDL COLESTEROL",
        "priceUsd": 5.8
      },
      {
        "name": "LEUCOGRAMA FECAL",
        "priceUsd": 4
      },
      {
        "name": "LIPASA",
        "priceUsd": 15
      },
      {
        "name": "LIPIDOS TOTALES",
        "priceUsd": 3
      },
      {
        "name": "MACHADO GUERREIRO(CHAGAS)",
        "priceUsd": 15
      },
      {
        "name": "MAGNESIO ORINA 24 H",
        "priceUsd": 7
      },
      {
        "name": "MAGNESIO ORINA PARCIAL",
        "priceUsd": 7
      },
      {
        "name": "MAGNESIO SERICO",
        "priceUsd": 7
      },
      {
        "name": "MALARIA",
        "priceUsd": 13
      },
      {
        "name": "MARIHUANA O",
        "priceUsd": 5
      },
      {
        "name": "MICOPLASMA IgG",
        "priceUsd": 10
      },
      {
        "name": "MICOPLASMA IgM",
        "priceUsd": 8
      },
      {
        "name": "ORINA",
        "priceUsd": 5
      },
      {
        "name": "POTASIO EN ORINA PARCIAL",
        "priceUsd": 5.5
      },
      {
        "name": "POTASIO ORINA 24 H",
        "priceUsd": 5.5
      },
      {
        "name": "POTASIO ORINA PARCIAL",
        "priceUsd": 5.5
      },
      {
        "name": "POTASIO SERICO",
        "priceUsd": 5.5
      },
      {
        "name": "PROLACTINA",
        "priceUsd": 10
      },
      {
        "name": "PROTEINA \"C\" REACTIVA (P.C.R)",
        "priceUsd": 10
      },
      {
        "name": "PROTEINA C REACTIVA CUANTIFICADA",
        "priceUsd": 10
      },
      {
        "name": "PRUEBA DE EMBARAZO (ORINA)",
        "priceUsd": 5.8
      },
      {
        "name": "PRUEBA DE EMBARAZO (S)",
        "priceUsd": 5.8
      },
      {
        "name": "R.A. TEST",
        "priceUsd": 13
      },
      {
        "name": "REHABILITACION C/U",
        "priceUsd": 16
      },
      {
        "name": "RELACION AU/CREAT",
        "priceUsd": 8
      },
      {
        "name": "RX 1 PROYECCION",
        "priceUsd": 27
      },
      {
        "name": "RX 2 PROYECCION",
        "priceUsd": 32
      },
      {
        "name": "RX 3 PROYECCION",
        "priceUsd": 38
      },
      {
        "name": "RX 4 PROYECCION",
        "priceUsd": 40
      },
      {
        "name": "RX 5 PROYECCION",
        "priceUsd": 46
      },
      {
        "name": "SANGRE OCULTA EN HECES",
        "priceUsd": 10
      },
      {
        "name": "T.G.O-",
        "priceUsd": 4
      },
      {
        "name": "T.G.P.",
        "priceUsd": 4
      },
      {
        "name": "T.S.H",
        "priceUsd": 5
      },
      {
        "name": "T3 LIBRE",
        "priceUsd": 7
      },
      {
        "name": "TESTOSTERONA LIBRE",
        "priceUsd": 15
      },
      {
        "name": "TESTOSTERONA TOTAL",
        "priceUsd": 8
      },
      {
        "name": "TIEMPO DE PROTROMBINA (PT)",
        "priceUsd": 5
      },
      {
        "name": "TIEMPO TROMPOPLASTINA (PTT)",
        "priceUsd": 5
      },
      {
        "name": "TIROGLOBULINA",
        "priceUsd": 22.3
      },
      {
        "name": "TOXOPLASMOSIS A",
        "priceUsd": 8
      },
      {
        "name": "TOXOPLASMOSIS IgG",
        "priceUsd": 8
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 5
      },
      {
        "name": "ULTRASONIDO ABDOMINAL",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO DOPPLER ARTERIAL",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER CAROTIDEO",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER FETAL",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER GINECOLOGICO",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER MIEMBROS INF",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER MIEMBROS SUP",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER OBSTETRICO",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER PELVICO",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER PEQUEÑAS PARTES",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER PROSTATICO",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER RENAL",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER TESTICULAR",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER TIROIDEO",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO DOPPLER VENOSO",
        "priceUsd": 55
      },
      {
        "name": "ULTRASONIDO MAMARIO",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO PARTES BLANDAS",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO PELVICO",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO PROSTÁTICO",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO RENAL",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO TESTICULAR",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO TIROIDEO",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO TRANSRECTAL",
        "priceUsd": 35
      },
      {
        "name": "ULTRASONIDO TRANSVAGINAL",
        "priceUsd": 35
      },
      {
        "name": "UREA",
        "priceUsd": 4.69
      },
      {
        "name": "UREA ORINA PARCIAL",
        "priceUsd": 4.69
      },
      {
        "name": "UREA/ORINA 24H",
        "priceUsd": 4.69
      },
      {
        "name": "UROCULTIVO",
        "priceUsd": 41.3
      },
      {
        "name": "V.D.R.L. CUALITATIVO",
        "priceUsd": 5.5
      },
      {
        "name": "V.S.G",
        "priceUsd": 5
      },
      {
        "name": "VDRL",
        "priceUsd": 5.5
      },
      {
        "name": "VITAMINA B-12",
        "priceUsd": 26.6
      },
      {
        "name": "VITAMINA D",
        "priceUsd": 16.1
      },
      {
        "name": "VLDL COLESTEROL",
        "priceUsd": 5
      }
    ]
  },
  {
    "name": "ENVIASISTENCIA",
    "aliases": [
      "Enviasistencia"
    ],
    "rif": null,
    "services": [
      {
        "name": "ACIDO URICO",
        "priceUsd": 4.69
      },
      {
        "name": "ACIDO URICO EN ORINA 24 HORAS",
        "priceUsd": 4.69
      },
      {
        "name": "ACIDO URICO SERICO",
        "priceUsd": 4.69
      },
      {
        "name": "ALFA FETO PROTEINAS",
        "priceUsd": 24.37
      },
      {
        "name": "AMILASA",
        "priceUsd": 15
      },
      {
        "name": "AMILASA SERICA",
        "priceUsd": 15
      },
      {
        "name": "ANGIOTAC ABDOMINAL CON CONTRASTE EV.",
        "priceUsd": 360
      },
      {
        "name": "ANGIOTAC ABDOMINAL CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC DE AORTA ABDOMINAL CON CONTRASTE EV.",
        "priceUsd": 360
      },
      {
        "name": "ANGIOTAC DE AORTA ABDOMINAL CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC DE AORTA TORACICA CON CONTRASTE EV.",
        "priceUsd": 360
      },
      {
        "name": "ANGIOTAC DE AORTA TORACICA CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC DE MIEMBROS INFERIORES CON CONTRASTE EV.",
        "priceUsd": 360
      },
      {
        "name": "ANGIOTAC DE MIEMBROS INFERIORES CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC DE MIEMBROS SUPERIORES CON CONTRASTE EV.",
        "priceUsd": 360
      },
      {
        "name": "ANGIOTAC DE MIEMBROS SUPERIORES CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC DE TÓRAX CON CONTRASTE EV.",
        "priceUsd": 360
      },
      {
        "name": "ANGIOTAC DE TÓRAX CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC DE VASOS SUPRAORTICO, CARÓTIDA O CUELLO CON CONTRASTE EV.",
        "priceUsd": 360
      },
      {
        "name": "ANGIOTAC DE VASOS SUPRAORTICO, CARÓTIDA O CUELLO CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC RENAL CON CONTRASTE EV.",
        "priceUsd": 360
      },
      {
        "name": "ANGIOTAC RENAL CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC TORACICA CON CONTRASTE EV. Y RECONSTRUCCIÓN 3D",
        "priceUsd": 410
      },
      {
        "name": "ANGIOTAC TORACICA/ABDOMINAL CON CONTRASTE EV",
        "priceUsd": 360
      },
      {
        "name": "ANTI TOXOPLASMA IGG",
        "priceUsd": 10.5
      },
      {
        "name": "ANTI TOXOPLASMA IGM",
        "priceUsd": 13.13
      },
      {
        "name": "ANTIBIOGRAMA",
        "priceUsd": 43.13
      },
      {
        "name": "ANTICUERPOS ANTI DNA",
        "priceUsd": 37.5
      },
      {
        "name": "ANTICUERPOS ANTINUCLEARES ( ANA )",
        "priceUsd": 37.5
      },
      {
        "name": "ANTICUERPOS ANTITIROIDEOS",
        "priceUsd": 65.53
      },
      {
        "name": "BILIRRUBINA TOTAL",
        "priceUsd": 5.63
      },
      {
        "name": "BILIRRUBINA TOTAL Y F",
        "priceUsd": 9.37
      },
      {
        "name": "BIOPSIA",
        "priceUsd": 150
      },
      {
        "name": "BIOPSIA DE PLEURA",
        "priceUsd": 350
      },
      {
        "name": "BIOPSIA DE TRUCUT",
        "priceUsd": 450
      },
      {
        "name": "C3",
        "priceUsd": 26.26
      },
      {
        "name": "C4",
        "priceUsd": 26.26
      },
      {
        "name": "CA 125",
        "priceUsd": 18
      },
      {
        "name": "CA 15-3",
        "priceUsd": 18
      },
      {
        "name": "CA 19-9",
        "priceUsd": 18
      },
      {
        "name": "CA 72-4",
        "priceUsd": 22
      },
      {
        "name": "CALCIO",
        "priceUsd": 11.26
      },
      {
        "name": "CALCIO EN ORINA 24 HORAS",
        "priceUsd": 11.26
      },
      {
        "name": "CALCIO SERICO",
        "priceUsd": 11.26
      },
      {
        "name": "CALCITONINA",
        "priceUsd": 33.76
      },
      {
        "name": "CEA",
        "priceUsd": 22
      },
      {
        "name": "CITOLOGÍA VAGINAL",
        "priceUsd": 30
      },
      {
        "name": "CITOMEGALOVIRUS IGG",
        "priceUsd": 16.87
      },
      {
        "name": "CITOMEGALOVIRUS IGM",
        "priceUsd": 16.87
      },
      {
        "name": "CK-MB",
        "priceUsd": 22.5
      },
      {
        "name": "COLESTEROL",
        "priceUsd": 6.58
      },
      {
        "name": "COLESTEROL TOTAL Y SUS FRACCIONES",
        "priceUsd": 26.26
      },
      {
        "name": "COLONOSCOPIA CON POLIPECTOMIA(EDI)",
        "priceUsd": 450
      },
      {
        "name": "COLONOSCOPIA SIN POLIPECTOMIA (EDI)",
        "priceUsd": 380
      },
      {
        "name": "COLPOSCOPA",
        "priceUsd": 160
      },
      {
        "name": "COLPOSCOPIA",
        "priceUsd": 90
      },
      {
        "name": "COMPLEMENTO SERICO C3-C4-CH50",
        "priceUsd": 86.26
      },
      {
        "name": "CONSULTA: CARDIOLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: CIRUGIA GENERAL",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: DERMATOLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: GASTROENTEROLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: GINECOLOGIA OBSTETRICIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: MEDICINA GENERAL",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: MEDICINA INTERNA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: NEFROLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: NEUMONOLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: NEUMONOLOGIA PEDRIATRICA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: NEUROLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: OFTALMOLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: OTORRINOLARINGOLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: PEDIATRIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: PSIQUIATRIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: REHABILITACION / FISIATRIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: REUMATOLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: TRAUMATOLOGIA",
        "priceUsd": 55
      },
      {
        "name": "CONSULTA: UROLOGÍA",
        "priceUsd": 55
      },
      {
        "name": "COPROCULTIVO (CULTIVO DE LAS HECES)",
        "priceUsd": 48.76
      },
      {
        "name": "CPK",
        "priceUsd": 18.76
      },
      {
        "name": "CREATININA",
        "priceUsd": 4.69
      },
      {
        "name": "CULTIVO Y ANTIBIOGRAMA DE SECRECIÓN BRONQUIAL",
        "priceUsd": 43.13
      },
      {
        "name": "CURVA DE GLICEMIA INSULINA 3 HORAS CON 100GR DE GLUCOSA",
        "priceUsd": 86.26
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA 2 HRS CON 75 GRAMOS DE GLUCOSA",
        "priceUsd": 69.37
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA BASAL Y POSTPANDRIAL/2 HRS",
        "priceUsd": 56.26
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA CINCO HORAS",
        "priceUsd": 112.5
      },
      {
        "name": "DENGUE TEST",
        "priceUsd": 18.76
      },
      {
        "name": "DEPURACIÓN DE CREATININA Y PROTEINURIA EN ORINA DE 24 HRS",
        "priceUsd": 22.5
      },
      {
        "name": "DIMERO D",
        "priceUsd": 30
      },
      {
        "name": "ECO DOPPLER VENOSO DE MIEMBROS INFERIORES",
        "priceUsd": 100
      },
      {
        "name": "ECO PROSTATICO",
        "priceUsd": 35
      },
      {
        "name": "ECO-DOPPLER ARTERIAL DE MIEMBROS INFERIORES",
        "priceUsd": 100
      },
      {
        "name": "ECO-DOPPLER CAROTIDEO",
        "priceUsd": 100
      },
      {
        "name": "ECOCARDIOGRAMA DOPLER CARDIACO",
        "priceUsd": 100
      },
      {
        "name": "ECOGRAFIA OCULAR",
        "priceUsd": 60
      },
      {
        "name": "ECOSONOGRAMA ABDOMEN",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA ABDOMINO-PELVICO",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA DE PARTES BLANDAS",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA HEPATO-VESICULAR",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA MAMARIO",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA PELVICO",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA RENAL",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA TESTICULAR",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA TIROIDEO",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA TRANSVAGINAL",
        "priceUsd": 40
      },
      {
        "name": "ELECTROCARDIOGRAMA DE REPOSO",
        "priceUsd": 35
      },
      {
        "name": "ELECTROLITOS SÉRICOS (NA-K-CL). SODIO, POTASIO-CLORO",
        "priceUsd": 33.76
      },
      {
        "name": "ENDOSCOPIA DIGESTIVA SUPERIOR (EDS)",
        "priceUsd": 450
      },
      {
        "name": "EPSTEIN BARR VIRUS IGG",
        "priceUsd": 22.5
      },
      {
        "name": "EPSTEIN BARR VIRUS IGM",
        "priceUsd": 22.5
      },
      {
        "name": "ESPIROMETRÍA",
        "priceUsd": 90
      },
      {
        "name": "ESTRADIOL",
        "priceUsd": 18.76
      },
      {
        "name": "EVALUACION CARDIOVASCULAR PREOPERATORIA",
        "priceUsd": 70
      },
      {
        "name": "EXAMEN SERIADO DE HECES",
        "priceUsd": 19.69
      },
      {
        "name": "FACTOR REUMATOIDEO",
        "priceUsd": 14.08
      },
      {
        "name": "FERRITINA",
        "priceUsd": 20.63
      },
      {
        "name": "FIBRINOGENO",
        "priceUsd": 11.26
      },
      {
        "name": "FOLATO",
        "priceUsd": 31.87
      },
      {
        "name": "FOSFATASA ALCALINA",
        "priceUsd": 9.37
      },
      {
        "name": "FOSFORO",
        "priceUsd": 11.26
      },
      {
        "name": "FOSFORO EN ORINA 24 HORAS",
        "priceUsd": 11.26
      },
      {
        "name": "FSH",
        "priceUsd": 18.76
      },
      {
        "name": "GAMMAGLUTAMILTRANSPEPTIDASA (GGTP)",
        "priceUsd": 15
      },
      {
        "name": "GLICEMIA/GLUCOSA",
        "priceUsd": 5.63
      },
      {
        "name": "GOTA GRUESA",
        "priceUsd": 8
      },
      {
        "name": "GRUPO SANGUINEO",
        "priceUsd": 8.5
      },
      {
        "name": "HB GLUCOSILADA. (HEMOGLOBINA GLUCOSILADA)",
        "priceUsd": 31.87
      },
      {
        "name": "HCG BETA (CUANTITATIVA)",
        "priceUsd": 20.63
      },
      {
        "name": "HCG BETA SUERO ( CUALITATIVA )",
        "priceUsd": 11.26
      },
      {
        "name": "HDL COLESTEROL",
        "priceUsd": 6.58
      },
      {
        "name": "HECES",
        "priceUsd": 6.58
      },
      {
        "name": "HELICOBACTER PÍLORY EN HECES",
        "priceUsd": 22
      },
      {
        "name": "HELICOBACTER PÍLORY IGM",
        "priceUsd": 13.13
      },
      {
        "name": "HEMATOLOGÍA COMPLETA",
        "priceUsd": 10.32
      },
      {
        "name": "HEPATITIS A IgG . MARCADOR PARA HEPATITIS A",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS A IgM. MARCADOR PARA HEPATITIS A",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B ANTI HbsAg. MARCADOR PARA HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B ANTIGENO Hbe. HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B CORE Hbc.HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B CORE IgM.HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B HbsAg. HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS C",
        "priceUsd": 18.76
      },
      {
        "name": "HIERRO SERICO",
        "priceUsd": 18.76
      },
      {
        "name": "HIV",
        "priceUsd": 11.26
      },
      {
        "name": "HOLTER DE ARRITMIA",
        "priceUsd": 110
      },
      {
        "name": "INFILTRACIÓN DE CUALQUIER ARTICULACION",
        "priceUsd": 60
      },
      {
        "name": "INMOVILIZACIÓN FUNCIONAL",
        "priceUsd": 90
      },
      {
        "name": "INMUNOGLOBULINA A (IGA)",
        "priceUsd": 20.63
      },
      {
        "name": "INMUNOGLOBULINA E (IGE)",
        "priceUsd": 20.63
      },
      {
        "name": "INMUNOGLOBULINA G (IGG)",
        "priceUsd": 20.63
      },
      {
        "name": "INMUNOGLOBULINA M (IGM)",
        "priceUsd": 20.63
      },
      {
        "name": "INSULINA BASAL",
        "priceUsd": 18.76
      },
      {
        "name": "INSULINA POST PANDRIAL",
        "priceUsd": 18.76
      },
      {
        "name": "LDH",
        "priceUsd": 7.5
      },
      {
        "name": "LDL COLESTEROL",
        "priceUsd": 6.58
      },
      {
        "name": "LEUCOGRAMA FECAL",
        "priceUsd": 6
      },
      {
        "name": "LH",
        "priceUsd": 18.76
      },
      {
        "name": "MAGNESIO",
        "priceUsd": 11.26
      },
      {
        "name": "MALARIA/PALUDISMO",
        "priceUsd": 15
      },
      {
        "name": "MARCADORES VIRALES PARA HEPATITIS C",
        "priceUsd": 18.76
      },
      {
        "name": "MICROALBUMINURIA EN ORINA PARCIAL",
        "priceUsd": 20.63
      },
      {
        "name": "MONITOREO AMBULATORIO (HOLTER) DE LA PRESIÓN ARTERIAL ( MAPA)",
        "priceUsd": 110
      },
      {
        "name": "ORINA",
        "priceUsd": 6.58
      },
      {
        "name": "PERFIL 20",
        "priceUsd": 103.13
      },
      {
        "name": "PERFIL ANEMIA",
        "priceUsd": 61.87
      },
      {
        "name": "PERFIL DE COAGULACION",
        "priceUsd": 18.76
      },
      {
        "name": "PERFIL GENERAL",
        "priceUsd": 84.37
      },
      {
        "name": "PERFIL HEPATICO I",
        "priceUsd": 35.63
      },
      {
        "name": "PERFIL LIPIDICO",
        "priceUsd": 28.13
      },
      {
        "name": "PERFIL LITIASICO",
        "priceUsd": 15
      },
      {
        "name": "PERFIL PRENATAL",
        "priceUsd": 65.63
      },
      {
        "name": "PERFIL PREOPERATORIO",
        "priceUsd": 61.87
      },
      {
        "name": "PERFIL REUMATOIDE I",
        "priceUsd": 22.5
      },
      {
        "name": "PERFIL TIROIDEO I",
        "priceUsd": 50.63
      },
      {
        "name": "PERFIL TIROIDEO II",
        "priceUsd": 56.26
      },
      {
        "name": "POTASIO",
        "priceUsd": 11.26
      },
      {
        "name": "PROLACTINA SERICA",
        "priceUsd": 20.63
      },
      {
        "name": "PROTEINA C REACTIVA",
        "priceUsd": 11.26
      },
      {
        "name": "PROTEINA EN ORINA 24 HORAS",
        "priceUsd": 15
      },
      {
        "name": "PROTEINAS TOTALES Y FRACCIONADAS",
        "priceUsd": 9.37
      },
      {
        "name": "PROTEINURIA EN 24 HORAS",
        "priceUsd": 15
      },
      {
        "name": "PSA (Antígeno Prostático Específico)",
        "priceUsd": 37.5
      },
      {
        "name": "PT (Tiempo de Protrombina)",
        "priceUsd": 6.58
      },
      {
        "name": "RA TEST",
        "priceUsd": 15.5
      },
      {
        "name": "RELACION ACIDO U / CREATIN",
        "priceUsd": 10
      },
      {
        "name": "RELACION FOSFORO / CREATIN",
        "priceUsd": 15
      },
      {
        "name": "RELACION UREA / CREATIN",
        "priceUsd": 10
      },
      {
        "name": "RELACIONA CALCIO / CREATIN",
        "priceUsd": 15
      },
      {
        "name": "RETRACCION DE COAGULO",
        "priceUsd": 10
      },
      {
        "name": "SANGRE OCULTA EN HECES",
        "priceUsd": 11.26
      },
      {
        "name": "SESIONES DE FISIOTERAPIA C/U",
        "priceUsd": 25
      },
      {
        "name": "SGOT",
        "priceUsd": 7.5
      },
      {
        "name": "SGPT",
        "priceUsd": 7.5
      },
      {
        "name": "SODIO",
        "priceUsd": 11.26
      },
      {
        "name": "T3",
        "priceUsd": 18.76
      },
      {
        "name": "T4 LIBRE",
        "priceUsd": 18.76
      },
      {
        "name": "T4 TOTAL",
        "priceUsd": 18.76
      },
      {
        "name": "TAC DE ABDOMEN Y PELVIS CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE ABDOMEN Y PELVIS CON CONTRASTE ORAL",
        "priceUsd": 280
      },
      {
        "name": "TAC DE ABDOMEN Y PELVIS CON DOBLE CONTRASTE",
        "priceUsd": 360
      },
      {
        "name": "TAC DE ABDOMEN Y PELVIS SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE CADERA CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE CADERA CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE CADERA SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE COLUMNA CERVICAL CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE COLUMNA CERVICAL CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE COLUMNA CERVICAL SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE COLUMNA DORSAL CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE COLUMNA DORSAL CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE COLUMNA DORSAL SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE COLUMNA LUMBAR CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE COLUMNA LUMBAR CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE COLUMNA LUMBAR SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE CRÁNEO CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE CRÁNEO CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE CRÁNEO SIN CONTRASTE",
        "priceUsd": 110
      },
      {
        "name": "TAC DE CUELLO CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE CUELLO CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE CUELLO SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE MACÍZO FACIAL CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE MACÍZO FACIAL SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE MIEMBROS INFERIORES CON CONTRASTE",
        "priceUsd": 280
      },
      {
        "name": "TAC DE MIEMBROS INFERIORES CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE MIEMBROS INFERIORES SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE MIEMBROS SUPERIORES CON CONTRASTE",
        "priceUsd": 280
      },
      {
        "name": "TAC DE MIEMBROS SUPERIORES CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE MIEMBROS SUPERIORES SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE OÍDO/MASTOIDE CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE OÍDO/MASTOIDE SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE ÓRBITAS CON RECONSTRUCCIÓN",
        "priceUsd": 270
      },
      {
        "name": "TAC DE ÓRBITAS SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE SENOS PARANASALES CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE SENOS PARANASALES CON RECONSTRUCCIÓN 3D",
        "priceUsd": 270
      },
      {
        "name": "TAC DE SENOS PARANASALES SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TAC DE TÓRAX CON CONTRASTE EV.",
        "priceUsd": 280
      },
      {
        "name": "TAC DE TÓRAX SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "TIEMPO DE COAGULACION",
        "priceUsd": 13.13
      },
      {
        "name": "TIEMPO DE PROTOMBINA ( TP )",
        "priceUsd": 6.58
      },
      {
        "name": "TIEMPO DE TROMBOPLASTINA PARCIAL ( PTT )",
        "priceUsd": 6.58
      },
      {
        "name": "TIROGLOBULINA",
        "priceUsd": 26.26
      },
      {
        "name": "TITULOS DE ANTIESTREPTOLISINA (ASTO)",
        "priceUsd": 9.37
      },
      {
        "name": "TRANSAMINASA GLUTAMICO PIRUVICA (TSGP)",
        "priceUsd": 7.5
      },
      {
        "name": "TRANSAMINASA OXALOACETICA (SGOT)",
        "priceUsd": 7.5
      },
      {
        "name": "TRANSFERRINA",
        "priceUsd": 20.63
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 7.5
      },
      {
        "name": "TSH EN DMT1",
        "priceUsd": 18.76
      },
      {
        "name": "UREA",
        "priceUsd": 4.69
      },
      {
        "name": "UREA-CREATININA.",
        "priceUsd": 9.37
      },
      {
        "name": "UROCULTIVO",
        "priceUsd": 43.13
      },
      {
        "name": "UROTAC CON CONTRASTE EV.",
        "priceUsd": 270
      },
      {
        "name": "UROTAC CON RECONSTRUCCIÓN 3D",
        "priceUsd": 280
      },
      {
        "name": "UROTAC SIN CONTRASTE",
        "priceUsd": 140
      },
      {
        "name": "VB12",
        "priceUsd": 31.87
      },
      {
        "name": "VDRL",
        "priceUsd": 7.5
      },
      {
        "name": "VELOCIDAD DE SEDIMENTACION GLOBULAR (VSG)",
        "priceUsd": 6.58
      },
      {
        "name": "VLDL COLESTEROL",
        "priceUsd": 6.58
      }
    ]
  },
  {
    "name": "HISPANA DE SEGUROS, S.A",
    "aliases": [
      "La Hispana"
    ],
    "rif": null,
    "services": [
      {
        "name": "ACIDO URICO",
        "priceUsd": 4.69
      },
      {
        "name": "ACIDO URICO EN ORINA 24 HORAS",
        "priceUsd": 4.69
      },
      {
        "name": "ACIDO URICO SERICO",
        "priceUsd": 4.69
      },
      {
        "name": "ALFA FETO PROTEINAS",
        "priceUsd": 24.37
      },
      {
        "name": "AMILASA",
        "priceUsd": 15
      },
      {
        "name": "AMILASA SERICA",
        "priceUsd": 15
      },
      {
        "name": "ANTI TOXOPLASMA IGG",
        "priceUsd": 8
      },
      {
        "name": "ANTI TOXOPLASMA IGM",
        "priceUsd": 8
      },
      {
        "name": "ANTIBIOGRAMA / UROCULTIVO",
        "priceUsd": 43.13
      },
      {
        "name": "ANTICUERPOS ANTI DNA",
        "priceUsd": 37.5
      },
      {
        "name": "ANTICUERPOS ANTITIROIDEOS",
        "priceUsd": 65.53
      },
      {
        "name": "BILIRRUBINA TOTAL",
        "priceUsd": 5.63
      },
      {
        "name": "BILIRRUBINA TOTAL Y F",
        "priceUsd": 9.37
      },
      {
        "name": "BIOPSIA",
        "priceUsd": 150
      },
      {
        "name": "C3",
        "priceUsd": 26.26
      },
      {
        "name": "C4",
        "priceUsd": 26.26
      },
      {
        "name": "CA 125",
        "priceUsd": 18
      },
      {
        "name": "CA 15-3",
        "priceUsd": 18
      },
      {
        "name": "CA 19-9",
        "priceUsd": 18
      },
      {
        "name": "CA 72-4",
        "priceUsd": 22
      },
      {
        "name": "CALCIO",
        "priceUsd": 11.26
      },
      {
        "name": "CALCIO EN ORINA 24 HORAS",
        "priceUsd": 11.26
      },
      {
        "name": "CALCIO SERICO",
        "priceUsd": 11.26
      },
      {
        "name": "CALCITONINA",
        "priceUsd": 33.76
      },
      {
        "name": "CEA",
        "priceUsd": 22
      },
      {
        "name": "CITOLOGÍA VAGINAL",
        "priceUsd": 30
      },
      {
        "name": "CITOMEGALOVIRUS IGG",
        "priceUsd": 16.87
      },
      {
        "name": "CITOMEGALOVIRUS IGM",
        "priceUsd": 16.87
      },
      {
        "name": "CK-MB",
        "priceUsd": 22.5
      },
      {
        "name": "CLORO",
        "priceUsd": 11.26
      },
      {
        "name": "COLESTEROL",
        "priceUsd": 6.58
      },
      {
        "name": "COLESTEROL TOTAL Y SUS FRACCIONES",
        "priceUsd": 26.26
      },
      {
        "name": "COLONOSCOPIA CON POLIPECTOMIA(EDI)",
        "priceUsd": 450
      },
      {
        "name": "COLONOSCOPIA SIN POLIPECTOMIA (EDI)",
        "priceUsd": 380
      },
      {
        "name": "COLPOSCOPA",
        "priceUsd": 160
      },
      {
        "name": "COLPOSCOPIA",
        "priceUsd": 90
      },
      {
        "name": "COMPLEMENTO SERICO C3-C4-CH50",
        "priceUsd": 86.26
      },
      {
        "name": "CONSULTA: CARDIOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: CIRUGIA GENERAL",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: DERMATOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: GASTROENTEROLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: GINECOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: MEDICINA GENERAL",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: MEDICINA INTERNA",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: NEFROLOGIA",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: NEUMONOLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: NEUROLOGIA",
        "priceUsd": 60
      },
      {
        "name": "CONSULTA: OTORRINOLARINGOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: PEDIATRIA",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: REHABILITACION / FISIATRIA",
        "priceUsd": 45
      },
      {
        "name": "CONSULTA: REUMATOLOGIA",
        "priceUsd": 50
      },
      {
        "name": "CONSULTA: TRAUMATOLOGIA",
        "priceUsd": 45
      },
      {
        "name": "COPROCULTIVO (CULTIVO DE LAS HECES)",
        "priceUsd": 48.76
      },
      {
        "name": "CPK",
        "priceUsd": 18.76
      },
      {
        "name": "CREATININA",
        "priceUsd": 4.69
      },
      {
        "name": "CULTIVO Y ANTIBIOGRAMA DE SECRECIÓN BRONQUIAL",
        "priceUsd": 43.13
      },
      {
        "name": "CURVA DE GLICEMIA INSULINA 3 HORAS CON 100GR DE GLUCOSA",
        "priceUsd": 86.26
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA 2 HRS CON 75 GRAMOS DE GLUCOSA",
        "priceUsd": 69.37
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA BASAL Y POSTPANDRIAL/2 HRS",
        "priceUsd": 56.26
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA CINCO HORAS",
        "priceUsd": 112.5
      },
      {
        "name": "DENGUE NS1",
        "priceUsd": 20
      },
      {
        "name": "DENGUE TEST",
        "priceUsd": 18.76
      },
      {
        "name": "DEPURACIÓN DE CREATININA Y PROTEINURIA EN ORINA DE 24 HRS",
        "priceUsd": 22.5
      },
      {
        "name": "DIMERO D",
        "priceUsd": 30
      },
      {
        "name": "ECO DOPPLER VENOSO DE MIEMBROS INFERIORES",
        "priceUsd": 100
      },
      {
        "name": "ECO PROSTATICO",
        "priceUsd": 35
      },
      {
        "name": "ECO-DOPPLER ARTERIAL DE MIEMBROS INFERIORES",
        "priceUsd": 100
      },
      {
        "name": "ECO-DOPPLER CAROTIDEO",
        "priceUsd": 100
      },
      {
        "name": "ECOCARDIOGRAMA DOPLER CARDIACO",
        "priceUsd": 100
      },
      {
        "name": "ECOSONOGRAMA ABDOMEN",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA ABDOMINO-PELVICO",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA DE PARTES BLANDAS",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA HEPATO-VESICULAR",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA MAMARIO",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA OBSTETRICO",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA PELVICO",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA RENAL",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA TESTICULAR",
        "priceUsd": 35
      },
      {
        "name": "ECOSONOGRAMA TIROIDEO",
        "priceUsd": 35
      },
      {
        "name": "ELECTROCARDIOGRAMA DE REPOSO",
        "priceUsd": 35
      },
      {
        "name": "ELECTROENCEFALOGRAMA",
        "priceUsd": 100
      },
      {
        "name": "ELECTROLITOS SÉRICOS (NA-K-CL). SODIO, POTASIO-CLORO",
        "priceUsd": 33.76
      },
      {
        "name": "ENDOSCOPIA DIGESTIVA SUPERIOR (EDS)",
        "priceUsd": 400
      },
      {
        "name": "EPSTEIN BARR VIRUS IGG",
        "priceUsd": 22.5
      },
      {
        "name": "EPSTEIN BARR VIRUS IGM",
        "priceUsd": 22.5
      },
      {
        "name": "ESPIROMETRIA",
        "priceUsd": 90
      },
      {
        "name": "ESTRADIOL",
        "priceUsd": 18.76
      },
      {
        "name": "EVALUACION CARDIOVASCULAR PREOPERATORIA",
        "priceUsd": 70
      },
      {
        "name": "EXAMEN SERIADO DE HECES",
        "priceUsd": 19.69
      },
      {
        "name": "FACTOR REUMATOIDEO",
        "priceUsd": 14.08
      },
      {
        "name": "FERRITINA",
        "priceUsd": 20.63
      },
      {
        "name": "FIBRINOGENO",
        "priceUsd": 11.26
      },
      {
        "name": "FOLATO",
        "priceUsd": 31.87
      },
      {
        "name": "FOSFATASA ALCALINA",
        "priceUsd": 9.37
      },
      {
        "name": "FOSFORO",
        "priceUsd": 11.26
      },
      {
        "name": "FOSFORO EN ORINA 24 HORAS",
        "priceUsd": 11.26
      },
      {
        "name": "FSH",
        "priceUsd": 18.76
      },
      {
        "name": "GAMMAGLUTAMILTRANSPEPTIDASA (GGTP)",
        "priceUsd": 15
      },
      {
        "name": "GLICEMIA/GLUCOSA",
        "priceUsd": 5.63
      },
      {
        "name": "GOTA GRUESA",
        "priceUsd": 8
      },
      {
        "name": "GRUPO SANGUINEO",
        "priceUsd": 8.5
      },
      {
        "name": "HB GLUCOSILADA. (HEMOGLOBINA GLUCOSILADA)",
        "priceUsd": 31.87
      },
      {
        "name": "HCG BETA (CUANTITATIVA)",
        "priceUsd": 20.63
      },
      {
        "name": "HCG BETA SUERO ( CUALITATIVA )",
        "priceUsd": 11.26
      },
      {
        "name": "HDL COLESTEROL",
        "priceUsd": 6.58
      },
      {
        "name": "HECES",
        "priceUsd": 6.58
      },
      {
        "name": "HELICOBACTER PÍLORY EN HECES",
        "priceUsd": 22
      },
      {
        "name": "HELICOBACTER PÍLORY IGM",
        "priceUsd": 13.13
      },
      {
        "name": "HEMATOLOGÍA COMPLETA",
        "priceUsd": 10.32
      },
      {
        "name": "HEPATITIS A IgG . MARCADOR PARA HEPATITIS A",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS A IgM. MARCADOR PARA HEPATITIS A",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B ANTI HbsAg. MARCADOR PARA HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B ANTIGENO Hbe. HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B CORE Hbc.HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B CORE IgM.HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS B HbsAg. HEPATITIS B",
        "priceUsd": 18.76
      },
      {
        "name": "HEPATITIS C",
        "priceUsd": 18.76
      },
      {
        "name": "HIERRO SERICO",
        "priceUsd": 18.76
      },
      {
        "name": "HIV",
        "priceUsd": 11.26
      },
      {
        "name": "HOLTER DE ARRITMIA",
        "priceUsd": 110
      },
      {
        "name": "INFILTRACIÓN DE CUALQUIER ARTICULACION",
        "priceUsd": 60
      },
      {
        "name": "INMOVILIZACIÓN FUNCIONAL",
        "priceUsd": 90
      },
      {
        "name": "INMUNOGLOBULINA A (IGA)",
        "priceUsd": 20.63
      },
      {
        "name": "INMUNOGLOBULINA E (IGE)",
        "priceUsd": 20.63
      },
      {
        "name": "INMUNOGLOBULINA G (IGG)",
        "priceUsd": 20.63
      },
      {
        "name": "INMUNOGLOBULINA M (IGM)",
        "priceUsd": 20.63
      },
      {
        "name": "INSULINA BASAL",
        "priceUsd": 18.76
      },
      {
        "name": "INSULINA POST PANDRIAL",
        "priceUsd": 18.76
      },
      {
        "name": "LDH",
        "priceUsd": 7.5
      },
      {
        "name": "LDL COLESTEROL",
        "priceUsd": 6.58
      },
      {
        "name": "LEUCOGRAMA FECAL",
        "priceUsd": 6
      },
      {
        "name": "LH",
        "priceUsd": 18.76
      },
      {
        "name": "MAGNESIO",
        "priceUsd": 11.26
      },
      {
        "name": "MALARIA / PALUDISMO",
        "priceUsd": 15
      },
      {
        "name": "MARCADORES VIRALES PARA HEPATITIS C",
        "priceUsd": 18.76
      },
      {
        "name": "MICROALBUMINURIA EN ORINA PARCIAL",
        "priceUsd": 20.63
      },
      {
        "name": "MONITOREO AMBULATORIO (HOLTER) DE LA PRESIÓN ARTERIAL ( MAPA)",
        "priceUsd": 110
      },
      {
        "name": "ORINA",
        "priceUsd": 6.58
      },
      {
        "name": "PERFIL 20",
        "priceUsd": 103.13
      },
      {
        "name": "PERFIL GENERAL",
        "priceUsd": 84.37
      },
      {
        "name": "PERFIL HEPATICO I",
        "priceUsd": 35.63
      },
      {
        "name": "PERFIL LIPIDICO",
        "priceUsd": 28.13
      },
      {
        "name": "PERFIL LITIASICO",
        "priceUsd": 15
      },
      {
        "name": "PERFIL PRENATAL",
        "priceUsd": 63.63
      },
      {
        "name": "PERFIL PREOPERATORIO",
        "priceUsd": 61.87
      },
      {
        "name": "PERFIL REUMATOIDE I",
        "priceUsd": 22.5
      },
      {
        "name": "PERFIL TIROIDEO I",
        "priceUsd": 50.63
      },
      {
        "name": "PERFIL TIROIDEO II",
        "priceUsd": 56.26
      },
      {
        "name": "POTASIO",
        "priceUsd": 11.26
      },
      {
        "name": "PROLACTINA SERICA",
        "priceUsd": 20.63
      },
      {
        "name": "PROTEINA C REACTIVA",
        "priceUsd": 11.26
      },
      {
        "name": "PROTEINA EN ORINA 24 HORAS",
        "priceUsd": 15
      },
      {
        "name": "PROTEINAS TOTALES Y FRACCIONADAS",
        "priceUsd": 9.37
      },
      {
        "name": "PROTEINURIA EN 24 HORAS",
        "priceUsd": 15
      },
      {
        "name": "PSA (Antígeno Prostático Específico)",
        "priceUsd": 37.5
      },
      {
        "name": "PT (Tiempo de Protrombina)",
        "priceUsd": 6.58
      },
      {
        "name": "RA TES",
        "priceUsd": 15
      },
      {
        "name": "REALCION CALCIO / CREATININA",
        "priceUsd": 15
      },
      {
        "name": "REALCION FOSFORO / CREATININA",
        "priceUsd": 15
      },
      {
        "name": "RELACION ACIDO U / CREATININA",
        "priceUsd": 10
      },
      {
        "name": "RELACION UREA / CREATININA",
        "priceUsd": 10
      },
      {
        "name": "SANGRE OCULTA EN HECES",
        "priceUsd": 11.26
      },
      {
        "name": "SESIONES DE FISIOTERAPIA 5 SESIONES",
        "priceUsd": 100
      },
      {
        "name": "SGOT",
        "priceUsd": 7.5
      },
      {
        "name": "SGPT",
        "priceUsd": 7.5
      },
      {
        "name": "SODIO",
        "priceUsd": 11.26
      },
      {
        "name": "T3",
        "priceUsd": 18.76
      },
      {
        "name": "T4 LIBRE",
        "priceUsd": 18.76
      },
      {
        "name": "T4 TOTAL",
        "priceUsd": 18.76
      },
      {
        "name": "TIEMPO DE COAGULACION",
        "priceUsd": 13.13
      },
      {
        "name": "TIEMPO DE PROTOMBINA ( TP )",
        "priceUsd": 6.58
      },
      {
        "name": "TIEMPO DE TROMBOPLASTINA PARCIAL ( PTT )",
        "priceUsd": 6.58
      },
      {
        "name": "TIROGLOBULINA",
        "priceUsd": 26.26
      },
      {
        "name": "TITULOS DE ANTIESTREPTOLISINA (ASTO)",
        "priceUsd": 9.37
      },
      {
        "name": "TRANSAMINASA GLUTAMICO PIRUVICA (TSGP)",
        "priceUsd": 7.5
      },
      {
        "name": "TRANSAMINASA OXALOACETICA (SGOT)",
        "priceUsd": 7.5
      },
      {
        "name": "TRANSFERRINA",
        "priceUsd": 20.63
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 7.5
      },
      {
        "name": "TSH EN DMT1",
        "priceUsd": 18.76
      },
      {
        "name": "UREA",
        "priceUsd": 4.69
      },
      {
        "name": "UREA-CREATININA.",
        "priceUsd": 9.37
      },
      {
        "name": "UROCULTIVO",
        "priceUsd": 43.13
      },
      {
        "name": "VB12",
        "priceUsd": 31.87
      },
      {
        "name": "VDRL",
        "priceUsd": 7.5
      },
      {
        "name": "VELOCIDAD DE SEDIMENTACION GLOBULAR (VSG)",
        "priceUsd": 6.58
      },
      {
        "name": "VLDL COLESTEROL",
        "priceUsd": 6.58
      }
    ]
  },
  {
    "name": "SEGUROS VENEZUELA C.A",
    "aliases": [
      "Seguros Venezuela"
    ],
    "rif": null,
    "services": [
      {
        "name": "17 OH PROGESTERONA",
        "priceUsd": 11.8
      },
      {
        "name": "AC ANTI-BETA 2 GLICOPROTEINA IGG",
        "priceUsd": 18.88
      },
      {
        "name": "AC ANTI-BETA 2 GLICOPROTEINA IGM",
        "priceUsd": 18.88
      },
      {
        "name": "AC ANTI-PEPTIDO CITRULINADO CICLICO",
        "priceUsd": 18.88
      },
      {
        "name": "AC ANTI-TIROGLOBULINA",
        "priceUsd": 11.01
      },
      {
        "name": "AC ANTINUCLEARES (ANA)",
        "priceUsd": 53.5
      },
      {
        "name": "AC. ANTI-MUSCULO LISO (ANTI-ASMA)",
        "priceUsd": 41.7
      },
      {
        "name": "ACIDO FOLICO (FOLATO)",
        "priceUsd": 21.24
      },
      {
        "name": "ACIDO LACTICO",
        "priceUsd": 14.16
      },
      {
        "name": "ACIDO URICO",
        "priceUsd": 3.15
      },
      {
        "name": "ACIDO URICO EN ORINA PARCIAL",
        "priceUsd": 4.72
      },
      {
        "name": "ACIDO URICO ORINA 24 HORAS",
        "priceUsd": 4.72
      },
      {
        "name": "ACIDO VALPROICO (VALPRON)",
        "priceUsd": 29.9
      },
      {
        "name": "ACS ANTI-MPO (PANCA)",
        "priceUsd": 32.26
      },
      {
        "name": "ACS ANTI-PR3 (C-ANCA)",
        "priceUsd": 32.26
      },
      {
        "name": "ACTH",
        "priceUsd": 29.9
      },
      {
        "name": "ADENOVIRUS ROTAVIRUS EN HECES",
        "priceUsd": 14.16
      },
      {
        "name": "ALBUMINA",
        "priceUsd": 4.72
      },
      {
        "name": "ALFAFETOPROTEINA (AFP)",
        "priceUsd": 18.1
      },
      {
        "name": "ALT",
        "priceUsd": 4.72
      },
      {
        "name": "AMILASA",
        "priceUsd": 7.87
      },
      {
        "name": "AMILASA EN ORINA",
        "priceUsd": 7.87
      },
      {
        "name": "AMILASA EN ORINA 24H",
        "priceUsd": 7.87
      },
      {
        "name": "AMILASA EN ORINA PARCIAL",
        "priceUsd": 7.87
      },
      {
        "name": "AMONIO",
        "priceUsd": 19.67
      },
      {
        "name": "ANCA C",
        "priceUsd": 32.26
      },
      {
        "name": "ANCA P",
        "priceUsd": 32.26
      },
      {
        "name": "ANDROSTENEDIONA",
        "priceUsd": 12.59
      },
      {
        "name": "ANOSCOPIA",
        "priceUsd": 51.57
      },
      {
        "name": "ANTI-FOSFOLIPIDOS IGG",
        "priceUsd": 11.01
      },
      {
        "name": "ANTI-FOSFOLIPIDOS IGM",
        "priceUsd": 11.01
      },
      {
        "name": "ANTIC ANTI SS-B (ANTI-LA)",
        "priceUsd": 14.16
      },
      {
        "name": "ANTIC. ANTI MITOCONDRIALES (AMA)",
        "priceUsd": 28.32
      },
      {
        "name": "ANTIC. ANTI RNP (ANTI-RNP)",
        "priceUsd": 27.54
      },
      {
        "name": "ANTIC. ANTI SMITH (ANTI-SM)",
        "priceUsd": 18.1
      },
      {
        "name": "ANTIC. ANTI SS-A (ANTI-RO)",
        "priceUsd": 18.1
      },
      {
        "name": "ANTIC. ANTI TRANSGLUTAMINASA IGA",
        "priceUsd": 21.24
      },
      {
        "name": "ANTIC. ANTI TRANSGLUTAMINASA IGG",
        "priceUsd": 21.24
      },
      {
        "name": "ANTIC. ANTI TREPONEMA PALLIDUM",
        "priceUsd": 16.52
      },
      {
        "name": "ANTIC. ANTI-RETICULINA (ARA)",
        "priceUsd": 21.24
      },
      {
        "name": "ANTIC. ANTI-SCL 70 (ANTI-SCL-70)",
        "priceUsd": 18.1
      },
      {
        "name": "ANTICUERPOS ANTI TRANSGLUTAMINASA IGG/IGA",
        "priceUsd": 40.91
      },
      {
        "name": "ANTICUERPOS ANTI-DNA",
        "priceUsd": 16.52
      },
      {
        "name": "ANTICUERPOS ANTI-PEROXIDASA",
        "priceUsd": 11.01
      },
      {
        "name": "ANTICUERPOS ANTICARDIOLIPINAS IGA",
        "priceUsd": 29.9
      },
      {
        "name": "ANTICUERPOS ANTICARDIOLIPINAS IGG",
        "priceUsd": 21.24
      },
      {
        "name": "ANTICUERPOS ANTICARDIOLIPINAS IGM",
        "priceUsd": 21.24
      },
      {
        "name": "ANTICUERPOS ANTIGLIADINA (IGA)",
        "priceUsd": 21.24
      },
      {
        "name": "ANTICUERPOS ANTIGLIADINA (IGG)",
        "priceUsd": 21.24
      },
      {
        "name": "ANTIG. PROSTATICO LIBRE (PSA LIBRE)",
        "priceUsd": 11.8
      },
      {
        "name": "ANTIG. PROSTATICO TOTAL (PSA TOTAL)",
        "priceUsd": 11.8
      },
      {
        "name": "ANTIGENO (COVID) HISOPADO",
        "priceUsd": 11.8
      },
      {
        "name": "ANTIGENOS FEBRILES",
        "priceUsd": 11.8
      },
      {
        "name": "ASTO ANTIESTREPTOLISINA O",
        "priceUsd": 5.99
      },
      {
        "name": "AUDIOMETRIA",
        "priceUsd": 31.67
      },
      {
        "name": "AZUCARES REDUCTORES EN HECES",
        "priceUsd": 3.14
      },
      {
        "name": "BETA 2 GLICOPROTEINA (IGG)",
        "priceUsd": 18.88
      },
      {
        "name": "BETA 2 GLICOPROTEINA (IGM)",
        "priceUsd": 18.1
      },
      {
        "name": "BETA 2 MICROGLOBULINA",
        "priceUsd": 18.1
      },
      {
        "name": "BETA HCG (CUANTITATIVA)",
        "priceUsd": 11.8
      },
      {
        "name": "BILIRRUBINA DIRECTA",
        "priceUsd": 3.15
      },
      {
        "name": "BILIRRUBINA INDIRECTA",
        "priceUsd": 3.15
      },
      {
        "name": "BILIRRUBINA TOTAL",
        "priceUsd": 3.14
      },
      {
        "name": "BILIRRUBINA TOTAL Y FRACCIONADA",
        "priceUsd": 6.3
      },
      {
        "name": "BIOMETRIA EN AMBOS OJOS",
        "priceUsd": 36.19
      },
      {
        "name": "BIOPSIA CUELLO UTERINO",
        "priceUsd": 58.81
      },
      {
        "name": "BIOPSIA DE ENDOMETRIO",
        "priceUsd": 58.81
      },
      {
        "name": "BIOPSIA DE PIEL EN SACOBOCADO",
        "priceUsd": 144.76
      },
      {
        "name": "BIOPSIA GASTRICA",
        "priceUsd": 39.81
      },
      {
        "name": "BIOPSIA PROSTATICA",
        "priceUsd": 36.19
      },
      {
        "name": "BNP PEPTIDO NATRIURETICO",
        "priceUsd": 15.73
      },
      {
        "name": "BORDETELLA PERTUSIS IGG",
        "priceUsd": 29.9
      },
      {
        "name": "BORDETELLA PERTUSIS IGM",
        "priceUsd": 29.9
      },
      {
        "name": "BUN (NITROGENO UREICO EN SANGRE)",
        "priceUsd": 3.14
      },
      {
        "name": "C1 INHIBIDOR",
        "priceUsd": 27.54
      },
      {
        "name": "CA 125",
        "priceUsd": 11.01
      },
      {
        "name": "CA 15-3",
        "priceUsd": 11.01
      },
      {
        "name": "CA 19-9",
        "priceUsd": 11.01
      },
      {
        "name": "CA 72-4",
        "priceUsd": 33.04
      },
      {
        "name": "CALCIO",
        "priceUsd": 3.93
      },
      {
        "name": "CALCIO EN ORINA",
        "priceUsd": 4.72
      },
      {
        "name": "CALCIO EN ORINA PARCIAL",
        "priceUsd": 4.72
      },
      {
        "name": "CALCIO ORINA 24 HORAS",
        "priceUsd": 4.72
      },
      {
        "name": "CALCITONINA",
        "priceUsd": 44.06
      },
      {
        "name": "CALPROTECTINA",
        "priceUsd": 39.34
      },
      {
        "name": "CAMPIMETRIA",
        "priceUsd": 27.14
      },
      {
        "name": "CARBAMAZEPINA (TEGRETOL)",
        "priceUsd": 32.26
      },
      {
        "name": "CARGA GLUCOSADA (GLICOLAC)",
        "priceUsd": 5.51
      },
      {
        "name": "CATECOLAMINAS EN ORINA 24 H",
        "priceUsd": 28.32
      },
      {
        "name": "CATECOLAMINAS EN SANGRE",
        "priceUsd": 28.32
      },
      {
        "name": "CAUTERIZACION DE LESIONES VPH",
        "priceUsd": 84.14
      },
      {
        "name": "CEA ANTIGENO CARCINOEMBRIONARIO",
        "priceUsd": 11.01
      },
      {
        "name": "CELULAS LE",
        "priceUsd": 15.73
      },
      {
        "name": "CETONEMIA",
        "priceUsd": 2.36
      },
      {
        "name": "CETONURIA",
        "priceUsd": 2.36
      },
      {
        "name": "CH 50",
        "priceUsd": 48.78
      },
      {
        "name": "CHAGAS - MACHADO GUERRERO",
        "priceUsd": 18.1
      },
      {
        "name": "CHLAMYDIA PNEUMONIAE IGG.",
        "priceUsd": 19.67
      },
      {
        "name": "CHLAMYDIA PNEUMONIE IGM.",
        "priceUsd": 19.67
      },
      {
        "name": "CHLAMYDIA TRACOMATI IGG",
        "priceUsd": 19.67
      },
      {
        "name": "CHLAMYDIA TRACOMATI IGM",
        "priceUsd": 19.67
      },
      {
        "name": "CISTOSCOPIA FLEXIBLE",
        "priceUsd": 242.48
      },
      {
        "name": "CISTOSCOPIA RIGIDA",
        "priceUsd": 169.19
      },
      {
        "name": "CITOGRAMA NASAL - EOSINOFILOS MOCO NASAL",
        "priceUsd": 7.87
      },
      {
        "name": "CITOLOGIA",
        "priceUsd": 40
      },
      {
        "name": "CITOMEGALOVIRUS IG G",
        "priceUsd": 14.16
      },
      {
        "name": "CITOMEGALOVIRUS IG M",
        "priceUsd": 14.16
      },
      {
        "name": "CK CREATININA FOSFOQUINASA",
        "priceUsd": 11.8
      },
      {
        "name": "CKMB CREATININA FOSFOQUINASA MB",
        "priceUsd": 11.8
      },
      {
        "name": "CLORO",
        "priceUsd": 13.37
      },
      {
        "name": "CLORO EN ORINA",
        "priceUsd": 13.37
      },
      {
        "name": "CLORO EN ORINA 24H",
        "priceUsd": 13.37
      },
      {
        "name": "CLORO EN ORINA PARCIAL",
        "priceUsd": 13.37
      },
      {
        "name": "COCAINA",
        "priceUsd": 7.87
      },
      {
        "name": "COLESTEROL HDL",
        "priceUsd": 4.72
      },
      {
        "name": "COLESTEROL TOTAL",
        "priceUsd": 4.72
      },
      {
        "name": "COLONOSCOPIA CON POLIPECTOMIA",
        "priceUsd": 390
      },
      {
        "name": "COLONOSCOPIA SIN POLIPECTOMIA",
        "priceUsd": 291.33
      },
      {
        "name": "COLORACION BK / ZIEHL NEELSEN",
        "priceUsd": 11.8
      },
      {
        "name": "COLORACION BK / ZIEHL NEELSEN (CATIA)",
        "priceUsd": 15.73
      },
      {
        "name": "COLORACION DE GRAM",
        "priceUsd": 7.87
      },
      {
        "name": "COLORACION DE KINYOUN",
        "priceUsd": 4.72
      },
      {
        "name": "COLORACION TINTA CHINA",
        "priceUsd": 7.87
      },
      {
        "name": "COLPOSCOPIA",
        "priceUsd": 96.81
      },
      {
        "name": "COMPLEMENTO C3",
        "priceUsd": 21.24
      },
      {
        "name": "COMPLEMENTO C4",
        "priceUsd": 21.24
      },
      {
        "name": "COMPLEMENTO SERICO C3-C4-CH50",
        "priceUsd": 91.26
      },
      {
        "name": "CONTAJE ENDOTELIAL EN AMBOS OJOS",
        "priceUsd": 36.19
      },
      {
        "name": "COOMBS DIRECTO",
        "priceUsd": 9.44
      },
      {
        "name": "COPROCULTIVO",
        "priceUsd": 31.47
      },
      {
        "name": "CORTISOL",
        "priceUsd": 11.01
      },
      {
        "name": "CORTISOL EN ORINA",
        "priceUsd": 11.01
      },
      {
        "name": "CORTISOL ORINA 24 HORAS",
        "priceUsd": 11.01
      },
      {
        "name": "CORTISOL PM",
        "priceUsd": 11.01
      },
      {
        "name": "CREATININA",
        "priceUsd": 3.15
      },
      {
        "name": "CREATININA EN ORINA",
        "priceUsd": 3.15
      },
      {
        "name": "CREATININA EN ORINA DE 24 HORAS",
        "priceUsd": 3.15
      },
      {
        "name": "CREATININA EN ORINA PARCIAL",
        "priceUsd": 3.15
      },
      {
        "name": "CRIOAGLUTININAS",
        "priceUsd": 18.1
      },
      {
        "name": "CRIOGLOBULINAS",
        "priceUsd": 14.16
      },
      {
        "name": "CULTIVO DE BK + ZN",
        "priceUsd": 54.29
      },
      {
        "name": "CULTIVO DE ESPUTO",
        "priceUsd": 37.76
      },
      {
        "name": "CULTIVO DE EXUDADO VAGINAL",
        "priceUsd": 25.96
      },
      {
        "name": "CULTIVO DE HONGOS",
        "priceUsd": 47.2
      },
      {
        "name": "CULTIVO DE LIQUIDO",
        "priceUsd": 24.39
      },
      {
        "name": "CULTIVO DE SECRECION",
        "priceUsd": 25.96
      },
      {
        "name": "CULTIVO SECRECION URETRAL",
        "priceUsd": 25.96
      },
      {
        "name": "CURVA DE TENSION",
        "priceUsd": 27.14
      },
      {
        "name": "DENGUE ANTIGENO ANTICUERPO IGM/IGG/NS1",
        "priceUsd": 15.73
      },
      {
        "name": "DENSITOMETRIA OSEA",
        "priceUsd": 36.19
      },
      {
        "name": "DEPURACION DE CREATININA 24H",
        "priceUsd": 9.44
      },
      {
        "name": "DESHIDROGENASA LACTICA (LDH)",
        "priceUsd": 4.72
      },
      {
        "name": "DESTILACION DE QUIMIOTERAPIA",
        "priceUsd": 120.33
      },
      {
        "name": "DHEA",
        "priceUsd": 18.1
      },
      {
        "name": "DHEA SULFATO (DHEA SO4)",
        "priceUsd": 18.1
      },
      {
        "name": "DIGOXINA",
        "priceUsd": 34.62
      },
      {
        "name": "DILATACION RIGIDA URETRAL",
        "priceUsd": 96.81
      },
      {
        "name": "DIMERO D",
        "priceUsd": 14.16
      },
      {
        "name": "ECO ARTICULAR",
        "priceUsd": 45.24
      },
      {
        "name": "ECO DE PULMON",
        "priceUsd": 45.24
      },
      {
        "name": "ECO DOPPLER 2M ARTERIAL",
        "priceUsd": 45.24
      },
      {
        "name": "ECO DOPPLER 2M VENOSO",
        "priceUsd": 45.24
      },
      {
        "name": "ECO DOPPLER CAROTIDEO",
        "priceUsd": 45.24
      },
      {
        "name": "ECO DOPPLER MIEMBROS SUPERIOR UNO ART",
        "priceUsd": 45.24
      },
      {
        "name": "ECO DOPPLER MIEMBROS SUPERIOR UNO VEN",
        "priceUsd": 45.24
      },
      {
        "name": "ECO PELVICO / TRANSVAGINAL",
        "priceUsd": 47.95
      },
      {
        "name": "ECO PROSTATICO",
        "priceUsd": 47.95
      },
      {
        "name": "ECO RENAL",
        "priceUsd": 47.95
      },
      {
        "name": "ECOCARDIOGRAMA",
        "priceUsd": 90
      },
      {
        "name": "ECOSONOGRAMA DOPPLER",
        "priceUsd": 34
      },
      {
        "name": "ECOSONOGRAMA SIMPLE",
        "priceUsd": 30
      },
      {
        "name": "EFECTO ANGIOGRAFICO DE MIEMBRO",
        "priceUsd": 318.48
      },
      {
        "name": "ELECTROCARDIOGRAMA",
        "priceUsd": 20
      },
      {
        "name": "ELECTROCOGULACIÓN",
        "priceUsd": 146.57
      },
      {
        "name": "ELECTROENCEFALOGRAMA CONVENCIONAL",
        "priceUsd": 70
      },
      {
        "name": "ELECTROLITOS",
        "priceUsd": 14.16
      },
      {
        "name": "ELECTROLITOS EN ORINA 24 HORAS",
        "priceUsd": 14.16
      },
      {
        "name": "ELECTROLITOS EN ORINA PARCIAL",
        "priceUsd": 14.16
      },
      {
        "name": "ENDOSCOPIA DIGESTIVA SUPERIOR E INFERIOR",
        "priceUsd": 350
      },
      {
        "name": "EOSINOFILOS EN SANGRE",
        "priceUsd": 3.93
      },
      {
        "name": "EPAMIN (FENITOINA)",
        "priceUsd": 32.26
      },
      {
        "name": "EPSTEIN BARR VIRUS IGG",
        "priceUsd": 14.16
      },
      {
        "name": "EPSTEIN BARR VIRUS IGM",
        "priceUsd": 14.16
      },
      {
        "name": "ESPERMOCULTIVO",
        "priceUsd": 28.32
      },
      {
        "name": "ESPIROMETRIA",
        "priceUsd": 40
      },
      {
        "name": "ESTRADIOL",
        "priceUsd": 11.8
      },
      {
        "name": "ESTUDIO DE ESTRABISMO",
        "priceUsd": 27.14
      },
      {
        "name": "ESTUDIO DE PISO PELVICO",
        "priceUsd": 108.57
      },
      {
        "name": "ESTUDIO URODINAMICO HOMBRE",
        "priceUsd": 241.57
      },
      {
        "name": "ESTUDIO URODINAMICO MUJER",
        "priceUsd": 180.95
      },
      {
        "name": "EXAMEN DE HECES",
        "priceUsd": 4.52
      },
      {
        "name": "EXAMEN DE ORINA",
        "priceUsd": 2.5
      },
      {
        "name": "EXAMEN SERIADO DE HECES DIA 1",
        "priceUsd": 3.15
      },
      {
        "name": "EXAMEN SERIADO DE HECES DIA 2",
        "priceUsd": 3.15
      },
      {
        "name": "EXAMEN SERIADO DE HECES DIA 3",
        "priceUsd": 3.15
      },
      {
        "name": "EXCERESIS + ELECTROCOAGULACION",
        "priceUsd": 194.52
      },
      {
        "name": "EXCERESIS DE QUISTE",
        "priceUsd": 212.62
      },
      {
        "name": "EXCERESIS ELECTROCAUTERIO",
        "priceUsd": 241.57
      },
      {
        "name": "EXTRACCION DE CUERPOS EXTRAÑOS",
        "priceUsd": 58.81
      },
      {
        "name": "FACTOR REUMATOIDEO",
        "priceUsd": 9.44
      },
      {
        "name": "FACTOR REUMATOIDEO CUANTITATIVO",
        "priceUsd": 9.44
      },
      {
        "name": "FENOBARBITAL",
        "priceUsd": 25.18
      },
      {
        "name": "FERRITINA",
        "priceUsd": 11.8
      },
      {
        "name": "FIBRINOGENO",
        "priceUsd": 6.29
      },
      {
        "name": "FIMOSECTOMIA (en consultorio o Unidad Especial)",
        "priceUsd": 653.24
      },
      {
        "name": "FOSFATASA ACIDA PROSTÁTICA",
        "priceUsd": 25.18
      },
      {
        "name": "FOSFATASA ACIDA TOTAL",
        "priceUsd": 14.16
      },
      {
        "name": "FOSFATASA ALCALINA (ALP)",
        "priceUsd": 5.51
      },
      {
        "name": "FOSFORO",
        "priceUsd": 4.72
      },
      {
        "name": "FOSFORO EN ORINA 24 H",
        "priceUsd": 4.72
      },
      {
        "name": "FOSFORO EN ORINA PARCIAL",
        "priceUsd": 4.72
      },
      {
        "name": "FOSFORO ORINA",
        "priceUsd": 4.72
      },
      {
        "name": "FROTIS DE SANGRE PERIFERICA",
        "priceUsd": 7.87
      },
      {
        "name": "FSH",
        "priceUsd": 7.87
      },
      {
        "name": "FTA-ABS",
        "priceUsd": 9.44
      },
      {
        "name": "GAMMA GLUTAMILTRANSFERASA (GGT)",
        "priceUsd": 6.29
      },
      {
        "name": "GASES ARTERIALES",
        "priceUsd": 21.24
      },
      {
        "name": "GASES VENOSOS",
        "priceUsd": 19.67
      },
      {
        "name": "GASES VENOSOS (POST-PRANDIAL)",
        "priceUsd": 19.67
      },
      {
        "name": "GASTROSCOPIA",
        "priceUsd": 268.71
      },
      {
        "name": "GLICEMIA",
        "priceUsd": 3.15
      },
      {
        "name": "GLICEMIA 120'",
        "priceUsd": 4.72
      },
      {
        "name": "GLICEMIA 150'",
        "priceUsd": 4.72
      },
      {
        "name": "GLICEMIA 180'",
        "priceUsd": 4.72
      },
      {
        "name": "GLICEMIA 30'",
        "priceUsd": 4.72
      },
      {
        "name": "GLICEMIA 60'",
        "priceUsd": 4.72
      },
      {
        "name": "GLICEMIA 75 GR",
        "priceUsd": 4.72
      },
      {
        "name": "GLICEMIA 90'",
        "priceUsd": 4.72
      },
      {
        "name": "GLICEMIA E INSULINA BASAL Y POST-PRANDRIAL 120 MIN",
        "priceUsd": 23.6
      },
      {
        "name": "GLICEMIA POST CARGA 50 GR",
        "priceUsd": 4.72
      },
      {
        "name": "GLICEMIA POST PRANDIAL",
        "priceUsd": 4.72
      },
      {
        "name": "GOTA GRUESA",
        "priceUsd": 7.87
      },
      {
        "name": "GRUPO SANGUINEO - FACTOR RH",
        "priceUsd": 5.51
      },
      {
        "name": "HELICOBACTER PILORY EN HECES",
        "priceUsd": 7.08
      },
      {
        "name": "HELICOBACTER PYLORI IGG",
        "priceUsd": 11.8
      },
      {
        "name": "HELICOBACTER PYLORI IGM",
        "priceUsd": 11.8
      },
      {
        "name": "HEMATOCRITO",
        "priceUsd": 4.72
      },
      {
        "name": "HEMATOLOGIA COMPLETA",
        "priceUsd": 12.8
      },
      {
        "name": "HEMOCULTIVO",
        "priceUsd": 9.44
      },
      {
        "name": "HEMOGLOBINA GLICOSILADA A1C",
        "priceUsd": 4.72
      },
      {
        "name": "HEMOGLOBINA HEMATOCRITO",
        "priceUsd": 11.8
      },
      {
        "name": "HEPATITIS A IGM/ IGG",
        "priceUsd": 7.87
      },
      {
        "name": "HEPATITIS B AG SUPERFICIE",
        "priceUsd": 7.87
      },
      {
        "name": "HEPATITIS B CORE TOTAL",
        "priceUsd": 7.87
      },
      {
        "name": "HEPATITIS C",
        "priceUsd": 15.73
      },
      {
        "name": "HERPES SIMPLEX I",
        "priceUsd": 31.47
      },
      {
        "name": "HERPES SIMPLEX I IGG",
        "priceUsd": 15.73
      },
      {
        "name": "HERPES SIMPLEX I IGM",
        "priceUsd": 31.47
      },
      {
        "name": "HERPES SIMPLEX II",
        "priceUsd": 15.73
      },
      {
        "name": "HERPES SIMPLEX II IGG",
        "priceUsd": 15.73
      },
      {
        "name": "HERPES SIMPLEX II IGM",
        "priceUsd": 6.29
      },
      {
        "name": "HIERRO",
        "priceUsd": 9.44
      },
      {
        "name": "HIERRO CAPACIDAD DE FIJACIÓN",
        "priceUsd": 6.29
      },
      {
        "name": "HISTEROSCOPIA DIAGNOSTICA",
        "priceUsd": 241.57
      },
      {
        "name": "HISTEROSCOPIA TERAPEUTICA QX",
        "priceUsd": 604.38
      },
      {
        "name": "HIV CUALITATIVO",
        "priceUsd": 77.1
      },
      {
        "name": "HOLTER",
        "priceUsd": 90
      },
      {
        "name": "HOMOCISTEINA",
        "priceUsd": 29.9
      },
      {
        "name": "HORMONA PARATIROIDEA (PTH)",
        "priceUsd": 15.73
      },
      {
        "name": "INFLUENZA A+B PRUEBA RAPIDA",
        "priceUsd": 18.1
      },
      {
        "name": "INMUNOGLOBULINA A (IGA)",
        "priceUsd": 21.24
      },
      {
        "name": "INMUNOGLOBULINA A SALIVA",
        "priceUsd": 11.8
      },
      {
        "name": "INMUNOGLOBULINA E (IGE TOTAL)",
        "priceUsd": 14.16
      },
      {
        "name": "INMUNOGLOBULINA IGG",
        "priceUsd": 14.16
      },
      {
        "name": "INMUNOGLOBULINA IGM",
        "priceUsd": 7.87
      },
      {
        "name": "INSULINA",
        "priceUsd": 9.44
      },
      {
        "name": "INSULINA 120 MIN POST CARGA 50GR",
        "priceUsd": 9.44
      },
      {
        "name": "INSULINA 120 MIN POST CARGA 75 GR",
        "priceUsd": 9.44
      },
      {
        "name": "INSULINA 30",
        "priceUsd": 9.44
      },
      {
        "name": "INSULINA 60'",
        "priceUsd": 9.44
      },
      {
        "name": "INSULINA 90'",
        "priceUsd": 9.44
      },
      {
        "name": "INSULINA POST PRANDIAL",
        "priceUsd": 2.36
      },
      {
        "name": "LEUCOGRAMA FECAL",
        "priceUsd": 6.29
      },
      {
        "name": "LH",
        "priceUsd": 6.29
      },
      {
        "name": "LIPASA",
        "priceUsd": 6.29
      },
      {
        "name": "LIPASA EN ORINA",
        "priceUsd": 6.29
      },
      {
        "name": "LIPASA EN ORINA 24 HORAS",
        "priceUsd": 6.29
      },
      {
        "name": "LIPASA EN ORINA PARCIAL",
        "priceUsd": 6.3
      },
      {
        "name": "LIQUIDO CEFALORRAQUIDEO CITOQUIMIC",
        "priceUsd": 29.9
      },
      {
        "name": "MAGNESIO",
        "priceUsd": 3.93
      },
      {
        "name": "MAGNESIO EN ORINA",
        "priceUsd": 3.93
      },
      {
        "name": "MAGNESIO EN ORINA 24 H",
        "priceUsd": 3.93
      },
      {
        "name": "MAMOGRAFIA BILATERAL",
        "priceUsd": 52.25
      },
      {
        "name": "MAMOGRAFIA BILATERAL PROTESIS",
        "priceUsd": 57
      },
      {
        "name": "MAMOGRAFIA UNILATERAL HASTA TALLA 36",
        "priceUsd": 47.2
      },
      {
        "name": "MAPA",
        "priceUsd": 90
      },
      {
        "name": "MICROALBUMINURIA 24H",
        "priceUsd": 15.73
      },
      {
        "name": "MICROALBUMINURIA PARCIAL",
        "priceUsd": 11.8
      },
      {
        "name": "MONOTEST",
        "priceUsd": 6.29
      },
      {
        "name": "MORFOLOGIA PLAQUETARIA",
        "priceUsd": 2.36
      },
      {
        "name": "MYCOPLASMA IGA",
        "priceUsd": 18.88
      },
      {
        "name": "MYCOPLASMA PNEUMONIAE IGG",
        "priceUsd": 18.88
      },
      {
        "name": "MYCOPLASMA PNEUMONIAE IGM",
        "priceUsd": 18.88
      },
      {
        "name": "OCT DE NERVIO OPTICO Y DE MACULA",
        "priceUsd": 36.19
      },
      {
        "name": "OXALATO EN ORINA 24 H",
        "priceUsd": 29.9
      },
      {
        "name": "OXALATOS ORINA",
        "priceUsd": 29.9
      },
      {
        "name": "PANEL ALIMENTOS",
        "priceUsd": 59.01
      },
      {
        "name": "PANEL INHALANTES",
        "priceUsd": 59.01
      },
      {
        "name": "PAQUIMETRIA",
        "priceUsd": 27.14
      },
      {
        "name": "PCR CLOSTRIDIUM DIFFICILE",
        "priceUsd": 220.29
      },
      {
        "name": "PEPTIDO C",
        "priceUsd": 18.1
      },
      {
        "name": "PERFIL ANEMICO.",
        "priceUsd": 63.73
      },
      {
        "name": "PERFIL BARIATRICO (G)",
        "priceUsd": 125.88
      },
      {
        "name": "PERFIL CARDIACO (INCLUYE Hematología Completa / Orina / Glicemia / Creatinina / Ácido Úrico / Colesterol (HDL- LDL- VLDL) / Triglicéridos)",
        "priceUsd": 40
      },
      {
        "name": "PERFIL HEPATICO",
        "priceUsd": 15.73
      },
      {
        "name": "PERFIL HEPATICO II",
        "priceUsd": 18.88
      },
      {
        "name": "PERFIL HORMONAL FEMENINO.",
        "priceUsd": 47.2
      },
      {
        "name": "PERFIL LIPIDICO (INCLUYE: Colesterol (HDL- LDL- VLDL) / Triglicéridos / Lípidos Totales)",
        "priceUsd": 12
      },
      {
        "name": "PERFIL PEDIATRICO",
        "priceUsd": 14.16
      },
      {
        "name": "PERFIL PRE NATAL",
        "priceUsd": 22.03
      },
      {
        "name": "PERFIL PRE-EMPLEO",
        "priceUsd": 21.24
      },
      {
        "name": "PERFIL PRE-OPERATORIO",
        "priceUsd": 18.88
      },
      {
        "name": "PERFIL PREVACACIONAL (RRHH)",
        "priceUsd": 9.44
      },
      {
        "name": "PERFIL REUMATOIDE I",
        "priceUsd": 17
      },
      {
        "name": "PERFIL REUMATOIDE II",
        "priceUsd": 15.73
      },
      {
        "name": "PERFIL SARS/INFLU/RSV",
        "priceUsd": 19.67
      },
      {
        "name": "PERFIL SARS/INFLU/RSV/ADENOVIRUS",
        "priceUsd": 23.6
      },
      {
        "name": "PERFIL TIROIDEO I LIBRE",
        "priceUsd": 22.42
      },
      {
        "name": "PERFIL TIROIDEO II",
        "priceUsd": 33.04
      },
      {
        "name": "PERFIL TORCH",
        "priceUsd": 31.47
      },
      {
        "name": "PLAQUETAS",
        "priceUsd": 4.72
      },
      {
        "name": "POLIPECTOMIA GASTROSCOPIA SIMPLE",
        "priceUsd": 142.05
      },
      {
        "name": "POTASIO",
        "priceUsd": 14.16
      },
      {
        "name": "POTASIO EN ORINA",
        "priceUsd": 14.16
      },
      {
        "name": "POTASIO EN ORINA 24 H",
        "priceUsd": 14.16
      },
      {
        "name": "POTASIO EN ORINA PARCIAL",
        "priceUsd": 14.16
      },
      {
        "name": "POTASIO EN SANGRE TOTAL",
        "priceUsd": 14.16
      },
      {
        "name": "PRESION OCULAR",
        "priceUsd": 27.14
      },
      {
        "name": "PROCALCITONINA",
        "priceUsd": 18.1
      },
      {
        "name": "PROCEDIMIENTO ESPECIAL ENDOSCOPICOS QX (APLICA PARA CASOS SEGÚN CONDICIÓN MEDICA DEL ASEGURADO)",
        "priceUsd": 459.62
      },
      {
        "name": "PROGESTERONA",
        "priceUsd": 9.44
      },
      {
        "name": "PROLACTINA",
        "priceUsd": 9.44
      },
      {
        "name": "PROTEINA C REACTIVA",
        "priceUsd": 4.72
      },
      {
        "name": "PROTEINA DE BENCE JONES",
        "priceUsd": 3.93
      },
      {
        "name": "PROTEINAS EN ORINA PARCIAL",
        "priceUsd": 7.87
      },
      {
        "name": "PROTEINAS TOTALES",
        "priceUsd": 4.72
      },
      {
        "name": "PROTEINAS TOTALES Y FRACCIONADAS",
        "priceUsd": 11.01
      },
      {
        "name": "PROTEINURIA",
        "priceUsd": 3.93
      },
      {
        "name": "PROTEINURIA EN 24 HORAS",
        "priceUsd": 7.87
      },
      {
        "name": "PRUEBA DE EMBARAZO-HCG CUALITATIVA",
        "priceUsd": 3.93
      },
      {
        "name": "PRUEBA DE ESFUERZO",
        "priceUsd": 49.76
      },
      {
        "name": "PSA TOTAL Y LIBRE",
        "priceUsd": 23.6
      },
      {
        "name": "PUNCION GUIADA POR ECO",
        "priceUsd": 125.88
      },
      {
        "name": "PUNCION GUIADA POR ECO TAC",
        "priceUsd": 157.35
      },
      {
        "name": "RELAC CALCIO CREATININA ORINA PARCIAL",
        "priceUsd": 7.87
      },
      {
        "name": "RELACION AC. URICO CREATININA O/P",
        "priceUsd": 7.87
      },
      {
        "name": "RELACION AC. URICO/CREAT ORINA 24H",
        "priceUsd": 7.87
      },
      {
        "name": "RELACION CALCIO/CREATININA O/24H",
        "priceUsd": 7.87
      },
      {
        "name": "RELACION PROTEINA/CREATININA",
        "priceUsd": 7.87
      },
      {
        "name": "RELACION UREA/CREATININA O/24H",
        "priceUsd": 7.87
      },
      {
        "name": "RELACION UREA/CREATININA OR PARCIAL",
        "priceUsd": 7.87
      },
      {
        "name": "RESONANCIA MAGNETICA NUCLEAR CON CONTRASTE (RNM)",
        "priceUsd": 144.76
      },
      {
        "name": "RESONANCIA MAGNETICA NUCLEAR SIN CONTRASTE (RNM)",
        "priceUsd": 108.57
      },
      {
        "name": "RETICULOCITOS",
        "priceUsd": 4.72
      },
      {
        "name": "RETIRO DE CATETER DOBLE J",
        "priceUsd": 266.9
      },
      {
        "name": "ROTAVIRUS",
        "priceUsd": 7.08
      },
      {
        "name": "RUBEOLA IG G",
        "priceUsd": 14.16
      },
      {
        "name": "RUBEOLA IG M",
        "priceUsd": 14.16
      },
      {
        "name": "RX. CON CONTRASTE",
        "priceUsd": 165.22
      },
      {
        "name": "RX. CUALQUIER PARTE DEL CUERPO (1 PROYECCION)",
        "priceUsd": 15
      },
      {
        "name": "RX. CUALQUIER PARTE DEL CUERPO (2 PROYECCIONES)",
        "priceUsd": 20
      },
      {
        "name": "RX. CUALQUIER PARTE DEL CUERPO (3 PROYECCIONES)",
        "priceUsd": 25
      },
      {
        "name": "RX. CUALQUIER PARTE DEL CUERPO (4 PROYECCIONES)",
        "priceUsd": 28
      },
      {
        "name": "RX. CUALQUIER PARTE DEL CUERPO (5 PROYECCIONES)",
        "priceUsd": 32
      },
      {
        "name": "RX. CUALQUIER PARTE DEL CUERPO (6 PROYECCIONES)",
        "priceUsd": 40
      },
      {
        "name": "RX.CADWELL",
        "priceUsd": 23.6
      },
      {
        "name": "RX.CISTOGRAFIA MICCIONAL",
        "priceUsd": 165.22
      },
      {
        "name": "RX.CISTOURETROGRAFIA",
        "priceUsd": 165.22
      },
      {
        "name": "RX.COLANGIOGRAFIA TRANS-KERT",
        "priceUsd": 165.22
      },
      {
        "name": "RX.COLECISTOGRAFIA COLANGIO E.V.",
        "priceUsd": 165.22
      },
      {
        "name": "RX.COLECISTOGRAFIA ORAL",
        "priceUsd": 165.22
      },
      {
        "name": "RX.COLON POR ENEMA",
        "priceUsd": 165.22
      },
      {
        "name": "RX.COLUMNA BENDING",
        "priceUsd": 35.4
      },
      {
        "name": "RX.COLUMNA CERVICAL DINAMICA",
        "priceUsd": 70.81
      },
      {
        "name": "RX.COLUMNA CERVICAL FUNCIONAL",
        "priceUsd": 70.81
      },
      {
        "name": "RX.COLUMNA DORSO LUMBAR BENDING",
        "priceUsd": 23.6
      },
      {
        "name": "RX.CRANEO CADWELL",
        "priceUsd": 23.6
      },
      {
        "name": "RX.CRANEO TOWNE",
        "priceUsd": 23.6
      },
      {
        "name": "RX.CRANEO WATTERS",
        "priceUsd": 23.6
      },
      {
        "name": "RX.ESOFAG, ESTOM, DUODEN CON CONT",
        "priceUsd": 165.22
      },
      {
        "name": "RX.ESOFAGO, ESTOMAGO Y DUODENO S/C",
        "priceUsd": 165.22
      },
      {
        "name": "RX.ESOFAGOGRAMA",
        "priceUsd": 165.22
      },
      {
        "name": "RX.FISTULOGRAFIA PERIANAL",
        "priceUsd": 165.22
      },
      {
        "name": "RX.FISTULOGRAFIA PIE",
        "priceUsd": 165.22
      },
      {
        "name": "RX.HISTEROSALPINGOGRAFIA",
        "priceUsd": 165.22
      },
      {
        "name": "RX.MEDICION DE MIEMBROS",
        "priceUsd": 47.2
      },
      {
        "name": "RX.ORBITA AP WATTERS TOWN",
        "priceUsd": 43.27
      },
      {
        "name": "RX.PELVIMETRIA",
        "priceUsd": 70.81
      },
      {
        "name": "RX.PIELOGRAFIA",
        "priceUsd": 165.22
      },
      {
        "name": "RX.RINOFARINGE ADENOIDES BA BC",
        "priceUsd": 35.4
      },
      {
        "name": "RX.RINOFARINGE BA Y BC",
        "priceUsd": 35.4
      },
      {
        "name": "RX.SIALOGRAFIA DOS LADOS",
        "priceUsd": 165.22
      },
      {
        "name": "RX.SIALOGRAFIA UN LADO",
        "priceUsd": 165.22
      },
      {
        "name": "RX.SURVEY OSEO",
        "priceUsd": 236.02
      },
      {
        "name": "RX.TEMPOMAXILAR",
        "priceUsd": 35.4
      },
      {
        "name": "RX.TRANSITO INTESTINAL",
        "priceUsd": 165.22
      },
      {
        "name": "RX.URETROCISTOGRAFIA",
        "priceUsd": 165.22
      },
      {
        "name": "RX.UROGRAFIA DE ELIMINACION / INFUSION",
        "priceUsd": 165.22
      },
      {
        "name": "SANGRE OCULTA EN HECES",
        "priceUsd": 14.16
      },
      {
        "name": "SARAMPION IGG",
        "priceUsd": 14.16
      },
      {
        "name": "SARAMPION IGM",
        "priceUsd": 14.16
      },
      {
        "name": "SEDACIÓN",
        "priceUsd": 59.71
      },
      {
        "name": "SEDACION POR ANESTESIOLOGO",
        "priceUsd": 113.05
      },
      {
        "name": "SEROLOGIA SARS-COV-2",
        "priceUsd": 15.73
      },
      {
        "name": "SESION DE REHABILITACION (POR SESION INDEPENDIENTEMENTE LA(S) PATOLOGIA(S)",
        "priceUsd": 11
      },
      {
        "name": "SODIO",
        "priceUsd": 14.16
      },
      {
        "name": "SODIO EN ORINA 24H",
        "priceUsd": 14.16
      },
      {
        "name": "SODIO EN ORINA PARCIAL",
        "priceUsd": 14.16
      },
      {
        "name": "SODIO EN SANGRE TOTAL",
        "priceUsd": 14.16
      },
      {
        "name": "SOMATOMEDINA C (IGF-1)",
        "priceUsd": 37.76
      },
      {
        "name": "T3 LIBRE",
        "priceUsd": 7.08
      },
      {
        "name": "T3 TOTAL",
        "priceUsd": 7.08
      },
      {
        "name": "T4 LIBRE",
        "priceUsd": 7.08
      },
      {
        "name": "T4 TOTAL",
        "priceUsd": 6.29
      },
      {
        "name": "TAC ANGIO-TOMOGRAFIA CUELLO",
        "priceUsd": 424.84
      },
      {
        "name": "TAC ANGIOTAC AORTICA ABDOMINAL",
        "priceUsd": 424.84
      },
      {
        "name": "TAC ANGIOTAC AORTICA TORAXICA",
        "priceUsd": 424.84
      },
      {
        "name": "TAC ANGIOTAC CRANEO CON CONTRASTE",
        "priceUsd": 472.05
      },
      {
        "name": "TAC ANGIOTAC MIEMBROS INFERIORES",
        "priceUsd": 456.31
      },
      {
        "name": "TAC POLIGONO DE WILLIS",
        "priceUsd": 236.02
      },
      {
        "name": "TAC RECONSTRUCCION VOLUMETRICA",
        "priceUsd": 31.47
      },
      {
        "name": "TAC UROTAC CON CONTRASTE",
        "priceUsd": 244.29
      },
      {
        "name": "TAC UROTAC SIN CONTRASTE",
        "priceUsd": 165.22
      },
      {
        "name": "TEST DE TELLER",
        "priceUsd": 27.14
      },
      {
        "name": "TESTOSTERONA LIBRE*",
        "priceUsd": 11.8
      },
      {
        "name": "TESTOSTERONA TOTAL*",
        "priceUsd": 11.8
      },
      {
        "name": "TIEMPO DE PROTROMBINA (PT)",
        "priceUsd": 4.72
      },
      {
        "name": "TIEMPO PARCIAL TROMBOPLASTINA (PTT)",
        "priceUsd": 4.72
      },
      {
        "name": "TIROGLOBULINA",
        "priceUsd": 21.24
      },
      {
        "name": "TODAS LAS CONSULTAS (INDEPENDIENTEMENTE DE LA ESPECIALIDAD)",
        "priceUsd": 40
      },
      {
        "name": "TOMOGRAFIA AXIAL COMPUTARIZADA CON CONTRASTE (TAC)",
        "priceUsd": 199.05
      },
      {
        "name": "TOMOGRAFIA AXIAL COMPUTARIZADA SIN CONTRASTE (TAC)",
        "priceUsd": 108.57
      },
      {
        "name": "TOMOSINTESIS (TOMOMAMOGRAFIA)",
        "priceUsd": 78.67
      },
      {
        "name": "TOPOGRAFIA CORNEAL",
        "priceUsd": 36.19
      },
      {
        "name": "TOXOPLASMA IG G",
        "priceUsd": 14.16
      },
      {
        "name": "TOXOPLASMA IG M",
        "priceUsd": 14.16
      },
      {
        "name": "TRANSAMINASAS",
        "priceUsd": 6.29
      },
      {
        "name": "TRANSFERRINA",
        "priceUsd": 18.1
      },
      {
        "name": "TRATAMIENTO ORTOPTICO",
        "priceUsd": 27.14
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 4.72
      },
      {
        "name": "TROPONINA I",
        "priceUsd": 10.23
      },
      {
        "name": "TSH",
        "priceUsd": 7.08
      },
      {
        "name": "TUNEL INTERCONTINEO/RODILLA TU",
        "priceUsd": 35.4
      },
      {
        "name": "ULTRASONIDOS DE VIAS URINARIAS",
        "priceUsd": 36.19
      },
      {
        "name": "UREA",
        "priceUsd": 4.72
      },
      {
        "name": "UREA EN ORINA",
        "priceUsd": 3.15
      },
      {
        "name": "UREA EN ORINA 24H",
        "priceUsd": 3.15
      },
      {
        "name": "UROCULTIVO",
        "priceUsd": 24.39
      },
      {
        "name": "UROFLUJOMETRIA",
        "priceUsd": 72.38
      },
      {
        "name": "VARICELA ZOSTER IGG",
        "priceUsd": 19.67
      },
      {
        "name": "VARICELA ZOSTER IGM",
        "priceUsd": 19.67
      },
      {
        "name": "VASECTOMIA (en consultorio o Unidad Especial)",
        "priceUsd": 484.05
      },
      {
        "name": "VDRL",
        "priceUsd": 5.51
      },
      {
        "name": "VELOCIDAD DE SEDIMENTACION GLOBULAR",
        "priceUsd": 3.93
      },
      {
        "name": "VIDEOGASTROSCOPIA + BIOPSIA + SEDACION",
        "priceUsd": 439.85
      },
      {
        "name": "VITAMINA B12",
        "priceUsd": 18.88
      },
      {
        "name": "VITAMINA D TOTAL",
        "priceUsd": 18.88
      }
    ]
  },
  {
    "name": "SEGUROS UNIVERSITAS, C.A",
    "aliases": [
      "Seguros Universitas"
    ],
    "rif": null,
    "services": [
      {
        "name": "17 OH PROGESTERONA",
        "priceUsd": 16
      },
      {
        "name": "ACIDO URICO EN ORINA",
        "priceUsd": 6
      },
      {
        "name": "ACIDO URICO EN ORINA DE 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "ACIDO URICO EN SANGRE",
        "priceUsd": 6
      },
      {
        "name": "ALBUMINA",
        "priceUsd": 10
      },
      {
        "name": "ALFAFETOPROTEINA (AFP)",
        "priceUsd": 16
      },
      {
        "name": "AMILASA",
        "priceUsd": 9
      },
      {
        "name": "ANDROSTENEDIONA",
        "priceUsd": 20
      },
      {
        "name": "ANTI - ANTIMICROSOMIALES",
        "priceUsd": 11
      },
      {
        "name": "ANTI PEPTIDO CICLICO CITRULINADO",
        "priceUsd": 16
      },
      {
        "name": "ANTI-DNA",
        "priceUsd": 16
      },
      {
        "name": "ANTICUERPOS ANTI-CARDIOLIPINA IGG",
        "priceUsd": 22
      },
      {
        "name": "ANTICUERPOS ANTI-CARDIOLIPINA IGM",
        "priceUsd": 22
      },
      {
        "name": "ANTICUERPOS ANTI-NUCLEARES (ANA)",
        "priceUsd": 20
      },
      {
        "name": "ANTICUERPOS ANTITIROGLOBULINA",
        "priceUsd": 16
      },
      {
        "name": "ANTIGENO CARCINOEMBRIONARIO (CEA)",
        "priceUsd": 13
      },
      {
        "name": "ANTIGENO DE SUPERFICIE AgHBs",
        "priceUsd": 25
      },
      {
        "name": "ANTIGENO PROSTATICO (PSA LIBRE)",
        "priceUsd": 19
      },
      {
        "name": "ANTIGENO PROSTATICO (PSA TOTAL)",
        "priceUsd": 18
      },
      {
        "name": "APLICACIÓN DE TRATAMIENTO",
        "priceUsd": 20
      },
      {
        "name": "BILIRRUBINA TOTAL Y FRACCIONADA",
        "priceUsd": 6
      },
      {
        "name": "C3",
        "priceUsd": 16
      },
      {
        "name": "C4",
        "priceUsd": 16
      },
      {
        "name": "CA 15-3",
        "priceUsd": 16
      },
      {
        "name": "CA 19-9",
        "priceUsd": 16
      },
      {
        "name": "CA-125",
        "priceUsd": 16
      },
      {
        "name": "CALCIO EN ORINA DE 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "CALCIO EN ORINA PARCIAL",
        "priceUsd": 6
      },
      {
        "name": "CALCIO EN SANGRE",
        "priceUsd": 6
      },
      {
        "name": "CAP. FIJACION DE HIERRO",
        "priceUsd": 11
      },
      {
        "name": "CH50 COMPLEMENTO HEMOLITICO",
        "priceUsd": 19
      },
      {
        "name": "CHAGAS",
        "priceUsd": 16
      },
      {
        "name": "CIRUGIA DE MANOS",
        "priceUsd": 30
      },
      {
        "name": "CITOLOGÍA",
        "priceUsd": 35
      },
      {
        "name": "CITOMEGALOVIRUS IGG",
        "priceUsd": 14
      },
      {
        "name": "CITOMEGALOVIRUS IGM",
        "priceUsd": 14
      },
      {
        "name": "CK-MB",
        "priceUsd": 11
      },
      {
        "name": "CLORO EN ORINA PARCIAL",
        "priceUsd": 5.6
      },
      {
        "name": "CLORO EN SANGRE",
        "priceUsd": 5.6
      },
      {
        "name": "COCAINA",
        "priceUsd": 4
      },
      {
        "name": "COLESTEROL",
        "priceUsd": 6
      },
      {
        "name": "COLESTEROL HDL",
        "priceUsd": 6
      },
      {
        "name": "COLESTEROL VLDL",
        "priceUsd": 6
      },
      {
        "name": "COLPOSCOPIA",
        "priceUsd": 35
      },
      {
        "name": "CONSULTA DE GINECOLOGIA + CITOLOGIA",
        "priceUsd": 49
      },
      {
        "name": "CONSULTA DE GINECOLOGIA + CITOLOGIA+ECO TRANSVAGINAL",
        "priceUsd": 75
      },
      {
        "name": "CONSULTA: CARDIOLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: CIRUGIA GENERAL",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: DERMATOLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: FISIATRIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: GASTROENTEROLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: MEDICINA FAMILIAR",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: MEDICINA GENERAL",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: MEDICINA INTERNA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: NEFROLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: NEUMONOLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: NEUROLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: OTORRINOLARINGOLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: PEDIATRIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: TRAUMATOLOGIA",
        "priceUsd": 30
      },
      {
        "name": "CONSULTA: UROLOGÍA",
        "priceUsd": 30
      },
      {
        "name": "CONTROLES MEDICOS POR TRATAMIENTO AMBULATORIO",
        "priceUsd": 30
      },
      {
        "name": "COPROCULTIVO",
        "priceUsd": 22
      },
      {
        "name": "CORTISOL (AM)",
        "priceUsd": 16
      },
      {
        "name": "CORTISOL (PM)",
        "priceUsd": 16
      },
      {
        "name": "CREATININA EN ORINA",
        "priceUsd": 6
      },
      {
        "name": "CREATININA EN SANGRE",
        "priceUsd": 6
      },
      {
        "name": "CURA DE HERIDAS MEDICINA FAMILIAR",
        "priceUsd": 100
      },
      {
        "name": "CURA DE HERIDAS MEDICINA GENERAL",
        "priceUsd": 100
      },
      {
        "name": "CURA DE HERIDAS MEDICINA INTERNA",
        "priceUsd": 100
      },
      {
        "name": "CURA DE HERIDAS PEDIATRIA",
        "priceUsd": 100
      },
      {
        "name": "CURAS POST-OPERATORIAS",
        "priceUsd": 130
      },
      {
        "name": "DENGUE BLOT IGG",
        "priceUsd": 12
      },
      {
        "name": "DENGUE BLOT IGM",
        "priceUsd": 9
      },
      {
        "name": "DEPURACION DE CREATININA",
        "priceUsd": 8
      },
      {
        "name": "DEPURACION DE UREA",
        "priceUsd": 8
      },
      {
        "name": "DIMERO D",
        "priceUsd": 20
      },
      {
        "name": "DRENAJE DE ABSCESOS MEDICINA FAMILIAR",
        "priceUsd": 180
      },
      {
        "name": "DRENAJE DE ABSCESOS MEDICINA GENERAL",
        "priceUsd": 180
      },
      {
        "name": "DRENAJE DE ABSCESOS MEDICINA INTERNA",
        "priceUsd": 180
      },
      {
        "name": "ECO ABDOMINAL",
        "priceUsd": 25
      },
      {
        "name": "ECO ABDOMINO-PÉLVICO",
        "priceUsd": 25
      },
      {
        "name": "ECO DE CUELLO",
        "priceUsd": 25
      },
      {
        "name": "ECO GINECOLOGICO",
        "priceUsd": 25
      },
      {
        "name": "ECO HEPATICO",
        "priceUsd": 25
      },
      {
        "name": "ECO MAMARIO",
        "priceUsd": 25
      },
      {
        "name": "ECO OSTEO-MUSCULAR",
        "priceUsd": 30
      },
      {
        "name": "ECO PARTES BLANDAS",
        "priceUsd": 25
      },
      {
        "name": "ECO PÉLVICO",
        "priceUsd": 25
      },
      {
        "name": "ECO PROSTATICO",
        "priceUsd": 25
      },
      {
        "name": "ECO RENAL",
        "priceUsd": 30
      },
      {
        "name": "ECO TESTICULAR",
        "priceUsd": 25
      },
      {
        "name": "ECO TIROIDEO",
        "priceUsd": 25
      },
      {
        "name": "ECO TRANSVAGINAL",
        "priceUsd": 25
      },
      {
        "name": "ECOCARDIOGRAMA",
        "priceUsd": 85
      },
      {
        "name": "ECOSONOGRAMA OBSTÉTRICO",
        "priceUsd": 25
      },
      {
        "name": "ELECTROCARDIOGRAMA",
        "priceUsd": 20
      },
      {
        "name": "ELECTROCARDIOGRAMA CARDIOLOGIA",
        "priceUsd": 20
      },
      {
        "name": "ELECTROENCEFALOGRAMA",
        "priceUsd": 70
      },
      {
        "name": "ELECTROLITOS EN ORINA PARCIAL",
        "priceUsd": 13
      },
      {
        "name": "ELECTROLITOS EN SUERO",
        "priceUsd": 13
      },
      {
        "name": "ENDOSCOPIA DIGESTIVA INFERIOR - COLONOSCOPIA",
        "priceUsd": 420
      },
      {
        "name": "ENDOSCOPIA DIGESTIVA SUPERIOR - GASTROSCOPIA",
        "priceUsd": 390
      },
      {
        "name": "EPSTEIN BARR VIRUS IGG",
        "priceUsd": 16
      },
      {
        "name": "EPSTEIN BARR VIRUS IGM",
        "priceUsd": 16
      },
      {
        "name": "ESPIROMETRIA",
        "priceUsd": 49
      },
      {
        "name": "ESTRADIOL",
        "priceUsd": 11
      },
      {
        "name": "EVALUACION CARDIOLOGICA PREOPERATORIA",
        "priceUsd": 45
      },
      {
        "name": "EVALUACION PREOPERATORIA",
        "priceUsd": 40
      },
      {
        "name": "FERRITINA",
        "priceUsd": 12
      },
      {
        "name": "FIBRINÓGENO",
        "priceUsd": 8
      },
      {
        "name": "FOSFATASA ALCALINA",
        "priceUsd": 6
      },
      {
        "name": "FOSFORO EN ORINA 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "FOSFORO EN ORINA PARCIAL",
        "priceUsd": 6
      },
      {
        "name": "FOSFORO EN SANGRE",
        "priceUsd": 8
      },
      {
        "name": "FSH",
        "priceUsd": 16
      },
      {
        "name": "GINE-OBSTETRICIA",
        "priceUsd": 30
      },
      {
        "name": "GINE-OBSTETRICIA - PRE NATAL",
        "priceUsd": 30
      },
      {
        "name": "GLICEMIA BASAL",
        "priceUsd": 6
      },
      {
        "name": "GLICEMIA POST PANDRIAL",
        "priceUsd": 6
      },
      {
        "name": "GRUPO SANGUINEO Y FACTOR RH",
        "priceUsd": 8
      },
      {
        "name": "HCG CUALITATIVA",
        "priceUsd": 9
      },
      {
        "name": "HCG CUANTITATIVA",
        "priceUsd": 19
      },
      {
        "name": "HECES",
        "priceUsd": 4
      },
      {
        "name": "HELICOBACTER PYLORI IGG",
        "priceUsd": 16
      },
      {
        "name": "HELICOBACTER PYLORI IGM",
        "priceUsd": 16
      },
      {
        "name": "HEMATOLOGÍA COMPLETA",
        "priceUsd": 6
      },
      {
        "name": "HEMOGLOBINA GLICOSILADA",
        "priceUsd": 18
      },
      {
        "name": "HEPATITIS A IGG",
        "priceUsd": 16
      },
      {
        "name": "HEPATITIS A IGM",
        "priceUsd": 16
      },
      {
        "name": "HEPATITIS B ANTICORE IGG",
        "priceUsd": 16
      },
      {
        "name": "HEPATITIS B ANTICORE IGM",
        "priceUsd": 16
      },
      {
        "name": "HEPATITIS B ANTIGENO SUPERFICIE",
        "priceUsd": 16
      },
      {
        "name": "HEPATITIS C",
        "priceUsd": 12
      },
      {
        "name": "HERPES SIMPLEX I IGG",
        "priceUsd": 18
      },
      {
        "name": "HERPES SIMPLEX I IGM",
        "priceUsd": 18
      },
      {
        "name": "HERPES SIMPLEX II IGG",
        "priceUsd": 18
      },
      {
        "name": "HERPES SIMPLEX II IGM",
        "priceUsd": 18
      },
      {
        "name": "HIERRO SÉRICO",
        "priceUsd": 19
      },
      {
        "name": "HIV (ELISA) I/II",
        "priceUsd": 16
      },
      {
        "name": "HOLTER",
        "priceUsd": 60
      },
      {
        "name": "INMUNOGLOBULINA A",
        "priceUsd": 12
      },
      {
        "name": "INMUNOGLOBULINA E",
        "priceUsd": 12
      },
      {
        "name": "INMUNOGLOBULINA G",
        "priceUsd": 12
      },
      {
        "name": "INMUNOGLOBULINA M",
        "priceUsd": 12
      },
      {
        "name": "INSULINA BASAL",
        "priceUsd": 12
      },
      {
        "name": "INSULINA POST PANDRIAL",
        "priceUsd": 19
      },
      {
        "name": "LDH (DESHIDROGENASA LACTICA)",
        "priceUsd": 8
      },
      {
        "name": "LH",
        "priceUsd": 12
      },
      {
        "name": "LIBERACIÓN DE ADHERENCIA DE CICATRICES CON MASAJE DE CYRIAX",
        "priceUsd": 21
      },
      {
        "name": "LIMPIEZA INSTRUMENTAL DE OIDO",
        "priceUsd": 50
      },
      {
        "name": "LIPASA",
        "priceUsd": 15
      },
      {
        "name": "MAGNESIO EN SANGRE",
        "priceUsd": 8
      },
      {
        "name": "MANIPULACIONES VERTEBRALES POR SESION",
        "priceUsd": 44
      },
      {
        "name": "MAPA",
        "priceUsd": 60
      },
      {
        "name": "MARIHUANA",
        "priceUsd": 8
      },
      {
        "name": "MASAJE DE LIBERACIÓN MIOSFASCIAL",
        "priceUsd": 21
      },
      {
        "name": "MICROALBUMINURIA",
        "priceUsd": 16
      },
      {
        "name": "NEBULIZACIONES PEDIATRIA",
        "priceUsd": 20
      },
      {
        "name": "NS1 (ANTIGENO DEL DENGUE)",
        "priceUsd": 20
      },
      {
        "name": "ORINA",
        "priceUsd": 5
      },
      {
        "name": "PERFIL 20",
        "priceUsd": 20
      },
      {
        "name": "PERFIL HEPÁTICO",
        "priceUsd": 19
      },
      {
        "name": "PERFIL HORMONAL FEMENINO",
        "priceUsd": 40
      },
      {
        "name": "PERFIL LIPIDICO",
        "priceUsd": 14
      },
      {
        "name": "PERFIL PEDIATRICO",
        "priceUsd": 16.32
      },
      {
        "name": "PERFIL PRE-OPERATORIO",
        "priceUsd": 25
      },
      {
        "name": "PERFIL REUMATICO",
        "priceUsd": 24.48
      },
      {
        "name": "PERFIL TIROIDEO (T3 - T4- TSH)",
        "priceUsd": 33
      },
      {
        "name": "PROGESTERONA",
        "priceUsd": 16
      },
      {
        "name": "PROLACTINA",
        "priceUsd": 12
      },
      {
        "name": "PROTEINAS C REACTIVAS (PCR)",
        "priceUsd": 12
      },
      {
        "name": "PROTEINAS TOTALES Y FRACCIONADAS",
        "priceUsd": 8
      },
      {
        "name": "PROTENURIA EN ORINA DE 24 HORAS",
        "priceUsd": 11
      },
      {
        "name": "PRUEBA DE ESFUERZO",
        "priceUsd": 70
      },
      {
        "name": "PUNCION CON AGUJA FINA DE TIROIDES",
        "priceUsd": 250
      },
      {
        "name": "RA-TEST CUANTITATIVO",
        "priceUsd": 13
      },
      {
        "name": "RELACION CALCIO / CREATININA",
        "priceUsd": 8
      },
      {
        "name": "RETIRO DE PUNTOS DE CIRUGIA GENERAL",
        "priceUsd": 40
      },
      {
        "name": "RX ABDOMEN AP",
        "priceUsd": 15
      },
      {
        "name": "RX ABDOMEN SIMPLE ACOSTADO Y DE PIE",
        "priceUsd": 20
      },
      {
        "name": "RX ANTEBRAZO AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX ANTEPIE AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX ARTICULACION TEMPORO MANDIBULAR",
        "priceUsd": 20
      },
      {
        "name": "RX BRAZO DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX BRAZO IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX CADERA AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX CADERA AP y OBLICUA",
        "priceUsd": 20
      },
      {
        "name": "RX CADERA AP-RANA",
        "priceUsd": 20
      },
      {
        "name": "RX CADERA AP. LAT. ROTACION",
        "priceUsd": 25
      },
      {
        "name": "RX CALCANEO DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX CALCANEO IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX CARA AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX CLAVICULA AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX CLAVICULA AP TANG",
        "priceUsd": 20
      },
      {
        "name": "RX CODO DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX CODO IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX COLUMNA CERVICAL AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX COLUMNA CERVICAL AP LAT DINAM",
        "priceUsd": 25
      },
      {
        "name": "RX COLUMNA CERVICAL AP LAT OB DINAMICA",
        "priceUsd": 40
      },
      {
        "name": "RX COLUMNA CERVICAL AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX COLUMNA CERVICAL DINAMICA",
        "priceUsd": 15
      },
      {
        "name": "RX COLUMNA DORSAL AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX COLUMNA DORSAL AP LAT DINAM",
        "priceUsd": 25
      },
      {
        "name": "RX COLUMNA DORSAL AP LAT OB DINAMICA",
        "priceUsd": 40
      },
      {
        "name": "RX COLUMNA DORSAL AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX COLUMNA DORSAL DINAMICA",
        "priceUsd": 30
      },
      {
        "name": "RX COLUMNA LUMBAR",
        "priceUsd": 20
      },
      {
        "name": "RX COLUMNA LUMBAR AP LAT DINAM",
        "priceUsd": 25
      },
      {
        "name": "RX COLUMNA LUMBAR AP LAT OB DINAMICA",
        "priceUsd": 40
      },
      {
        "name": "RX COLUMNA LUMBAR AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX COLUMNA LUMBAR SACRA AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX COLUMNA LUMBOSACRA DINAMICA",
        "priceUsd": 30
      },
      {
        "name": "RX COLUMNA SACRA (AP Y LAT)",
        "priceUsd": 20
      },
      {
        "name": "RX COLUMNA SACRO COXIS AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX COLUMNA SACRO COXIS AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX COXIS AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX COXOFEMORALES",
        "priceUsd": 20
      },
      {
        "name": "RX CRANEO AP",
        "priceUsd": 20
      },
      {
        "name": "RX CRANEO AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX CUELLO AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX DE ADENOIDES",
        "priceUsd": 20
      },
      {
        "name": "RX DE PELVIS CENTRADA EN PUBIS",
        "priceUsd": 15
      },
      {
        "name": "RX DEDO AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX EDAD OSEA",
        "priceUsd": 15
      },
      {
        "name": "RX FEMUR AP OBLIC",
        "priceUsd": 20
      },
      {
        "name": "RX FEMUR DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX FEMUR IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX HOMBRO AP AXIAL",
        "priceUsd": 20
      },
      {
        "name": "RX HOMBRO AP LAT AXIAL",
        "priceUsd": 25
      },
      {
        "name": "RX HOMBRO AP LAT ROT INT.EXT",
        "priceUsd": 35
      },
      {
        "name": "RX HOMBRO DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX HOMBRO IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX HUESOS PROPIOS DE CARA",
        "priceUsd": 20
      },
      {
        "name": "RX HUESOS PROPIOS NASALES",
        "priceUsd": 20
      },
      {
        "name": "RX HUMERO AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX MANO AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX MANO DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX MANO DER AP OBLIC",
        "priceUsd": 20
      },
      {
        "name": "RX MANO IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX MANO IZQ AP OBLIC",
        "priceUsd": 20
      },
      {
        "name": "RX MEDICION MIEMBROS INFERIORES",
        "priceUsd": 35
      },
      {
        "name": "RX MUNECA DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX MUNECA IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX ORBITA",
        "priceUsd": 20
      },
      {
        "name": "RX PELVIS AP",
        "priceUsd": 15
      },
      {
        "name": "RX PELVIS AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX PELVIS AP RANA",
        "priceUsd": 20
      },
      {
        "name": "RX PIE AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX PIE DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX PIE IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX PIERNA AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX PIERNA DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX PIERNA IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX RINOFARINGE",
        "priceUsd": 20
      },
      {
        "name": "RX RODILLA AP LAT AXIAL 30 60 90",
        "priceUsd": 40
      },
      {
        "name": "RX RODILLA DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX RODILLA IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX ROTULA AXIAL 30 60 90",
        "priceUsd": 25
      },
      {
        "name": "RX SACRO ILIACAS",
        "priceUsd": 25
      },
      {
        "name": "RX SENOS PARANASALES",
        "priceUsd": 25
      },
      {
        "name": "RX TIBIA DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX TIBIA IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX TOBILLO DER AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX TOBILLO DER AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX TOBILLO DER AP OBLIC",
        "priceUsd": 20
      },
      {
        "name": "RX TOBILLO IZQ AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX TOBILLO IZQ AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX TOBILLO IZQ AP OBLIC",
        "priceUsd": 20
      },
      {
        "name": "RX TORAX AP LAT",
        "priceUsd": 20
      },
      {
        "name": "RX TORAX OSEO AP LAT OBLIC",
        "priceUsd": 25
      },
      {
        "name": "RX TORAX PA",
        "priceUsd": 15
      },
      {
        "name": "SANGRE OCULTA",
        "priceUsd": 6
      },
      {
        "name": "SESION DE FISIOTERAPIA",
        "priceUsd": 22
      },
      {
        "name": "SESIONES FISIOTERAPIA (5 SESIONES)",
        "priceUsd": 110
      },
      {
        "name": "T3 LIBRE",
        "priceUsd": 14
      },
      {
        "name": "T3 TOTAL",
        "priceUsd": 14
      },
      {
        "name": "T4 LIBRE",
        "priceUsd": 14
      },
      {
        "name": "T4 TOTAL",
        "priceUsd": 14
      },
      {
        "name": "TAC DE SENOS PARANASALES",
        "priceUsd": 150
      },
      {
        "name": "TERAPIA NEURAL POR SESION",
        "priceUsd": 36
      },
      {
        "name": "TETOSTERONA LIBRE",
        "priceUsd": 16
      },
      {
        "name": "TETOSTERONA TOTAL",
        "priceUsd": 16
      },
      {
        "name": "TIEMPO DE PROTOMBINA (PT)",
        "priceUsd": 8
      },
      {
        "name": "TIEMPO DE PROTOMBINA (PTT)",
        "priceUsd": 8
      },
      {
        "name": "TOXOPLASMA IGG",
        "priceUsd": 12
      },
      {
        "name": "TOXOPLASMA IGM",
        "priceUsd": 12
      },
      {
        "name": "TRANSAMINASA OXALACETICA (AST)",
        "priceUsd": 6
      },
      {
        "name": "TRANSAMINASA PIRUVICA (ALT)",
        "priceUsd": 6
      },
      {
        "name": "TRANSFERRINA",
        "priceUsd": 16
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 6
      },
      {
        "name": "TROPONINA I",
        "priceUsd": 18
      },
      {
        "name": "TSH",
        "priceUsd": 16
      },
      {
        "name": "UREA",
        "priceUsd": 6
      },
      {
        "name": "UROCULTIVO",
        "priceUsd": 20
      },
      {
        "name": "VDRL CUALITATIVO",
        "priceUsd": 8
      },
      {
        "name": "VENDAJE NEUROMUSCULAR DE KINESIOTAPING POR REGIÓN ANATÓMICA",
        "priceUsd": 21
      },
      {
        "name": "VITAMINAS B12",
        "priceUsd": 21
      },
      {
        "name": "VSG",
        "priceUsd": 6
      }
    ]
  },
  {
    "name": "SEGUROS PIRAMIDE, C.A",
    "aliases": [
      "Seguros Pirámide"
    ],
    "rif": null,
    "services": [
      {
        "name": "ACIDO URICO EN ORINA (PARCIAL)",
        "priceUsd": 5
      },
      {
        "name": "ACIDO URICO EN SANGRE",
        "priceUsd": 4
      },
      {
        "name": "ALBUMINA",
        "priceUsd": 6
      },
      {
        "name": "ALFAFETOPROTEINAS (AFP)",
        "priceUsd": 14
      },
      {
        "name": "AMILASA",
        "priceUsd": 8
      },
      {
        "name": "AMILASA URINARIA",
        "priceUsd": 7
      },
      {
        "name": "ANDROSTENEDIONA",
        "priceUsd": 10
      },
      {
        "name": "ANTI CHLAM TRACHOMATIS IGG",
        "priceUsd": 11
      },
      {
        "name": "ANTI HAV (HEPATITIS A) IGG",
        "priceUsd": 10
      },
      {
        "name": "ANTI HAV (HEPATITIS A) IGM",
        "priceUsd": 10
      },
      {
        "name": "ANTI HBC (ANTI CORE HEPATITIS B TOTAL)",
        "priceUsd": 10
      },
      {
        "name": "ANTI HBC IGM (ANTI CORE HEPATITIS B)",
        "priceUsd": 10
      },
      {
        "name": "ANTI HBE (ANTIGENO E HEPATITIS B)",
        "priceUsd": 10
      },
      {
        "name": "ANTI HBS (ANTICUERPOS CONTRA EL AG DE SUPERFICIE HEPATITIS B)",
        "priceUsd": 12
      },
      {
        "name": "ANTI HBS (ANTIGENO DE SUPERFICIE HEPATITIS B)",
        "priceUsd": 10
      },
      {
        "name": "ANTI HCV (HEPATITIS C)",
        "priceUsd": 10
      },
      {
        "name": "ANTI MYCOPLASMA PNEUMONIAE IGG",
        "priceUsd": 8
      },
      {
        "name": "ANTI MYCOPLASMA PNEUMONIAE IGM",
        "priceUsd": 8
      },
      {
        "name": "ANTICUERPOS ANTI DNA DOBLE CADENA (ELISA)",
        "priceUsd": 15
      },
      {
        "name": "ANTICUERPOS ANTI TOXOPLASMA IGG",
        "priceUsd": 6
      },
      {
        "name": "ANTICUERPOS ANTI TOXOPLASMA IGM",
        "priceUsd": 6
      },
      {
        "name": "ANTICUERPOS ANTITIROIDEOS MICROSOMALES",
        "priceUsd": 12
      },
      {
        "name": "ANTIGENO CARCIEMBRIONARIO (CEA)",
        "priceUsd": 11
      },
      {
        "name": "ANTIGENO PROSTATICO ESPECIFICO LIBRE (PSA)L",
        "priceUsd": 10
      },
      {
        "name": "ANTIGENO PROSTATICO ESPECIFICO TOTAL (PSA)T",
        "priceUsd": 10
      },
      {
        "name": "BETA 2 MICROGLOBULINA EN ORINA",
        "priceUsd": 15
      },
      {
        "name": "BETA 2 MICROGLOBULINA EN SANGRE",
        "priceUsd": 12
      },
      {
        "name": "BILIRRUBINA TOTAL",
        "priceUsd": 5
      },
      {
        "name": "BILIRRUBINA TOTAL Y FRACCIONADA",
        "priceUsd": 5
      },
      {
        "name": "BIOPSIA MAS COLPOSCOPIA VULVOSCOPIA",
        "priceUsd": 120
      },
      {
        "name": "BK (CULTIVO)",
        "priceUsd": 8
      },
      {
        "name": "CA 125",
        "priceUsd": 12
      },
      {
        "name": "CA 15 3",
        "priceUsd": 12
      },
      {
        "name": "CA 19 9",
        "priceUsd": 12
      },
      {
        "name": "CALCIO EN ORINA 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "CALCIO EN SANGRE",
        "priceUsd": 6
      },
      {
        "name": "CAPACIDAD DE FIJACION DE HIERRO",
        "priceUsd": 8
      },
      {
        "name": "CARDIOLIPINAS (FOSFOLIPIDOS) PRUEBA CUANTITATIVA ANTICUR TIPO IGA IGG E IGM",
        "priceUsd": 12
      },
      {
        "name": "CARDIOLOGIA CONSULTA 1A VEZ ELECTROCARDIOGRAMA",
        "priceUsd": 50
      },
      {
        "name": "CARDIOLOGIA CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "CITOLOGIA GINECOLOGICA",
        "priceUsd": 25
      },
      {
        "name": "CLORO EN ORINA",
        "priceUsd": 5
      },
      {
        "name": "COLESTEROL HDL",
        "priceUsd": 4
      },
      {
        "name": "COLESTEROL LDL",
        "priceUsd": 4
      },
      {
        "name": "COLESTEROL TOTAL",
        "priceUsd": 4
      },
      {
        "name": "COLESTEROL TOTAL Y FRACCIONADO HDL LDL VLDL Y TRIGLICERIDOS",
        "priceUsd": 15
      },
      {
        "name": "COLESTEROL VLDL",
        "priceUsd": 4
      },
      {
        "name": "COLPOSCOPIA (VAGINOSCOPIA)",
        "priceUsd": 60
      },
      {
        "name": "COMPLEMENTO SERICO (C 3)",
        "priceUsd": 12
      },
      {
        "name": "COMPLEMENTO SERICO (C 4)",
        "priceUsd": 12
      },
      {
        "name": "COMPLEMENTO SERICO (CH 50)",
        "priceUsd": 15
      },
      {
        "name": "CONTEO O RECUENTO MINUTADO GLOBULOS BLANCOS",
        "priceUsd": 12
      },
      {
        "name": "COPROCULTIVO",
        "priceUsd": 20
      },
      {
        "name": "CORTISOL EN SANGRE",
        "priceUsd": 12
      },
      {
        "name": "CREATININA EN ORINA PARCIAL",
        "priceUsd": 4
      },
      {
        "name": "CREATININA EN SANGRE",
        "priceUsd": 4
      },
      {
        "name": "CREATININA FOSFOQUINASA (CKMB)",
        "priceUsd": 11
      },
      {
        "name": "CREATININA FOSFOQUINASA (CPK)",
        "priceUsd": 8
      },
      {
        "name": "CURVA GLUCO INSULINA PRE Y POST CARGA (2 HORAS) 0 60 120 MIN",
        "priceUsd": 18
      },
      {
        "name": "DEHIDROEPIANDROSTERONA SULFATO DHEA SO4",
        "priceUsd": 12
      },
      {
        "name": "DENGUE IGG",
        "priceUsd": 9
      },
      {
        "name": "DENGUE IGM",
        "priceUsd": 9
      },
      {
        "name": "DEPURACION DE CREATININA",
        "priceUsd": 5
      },
      {
        "name": "DESHIDROGENASA LACTICA (LDH)",
        "priceUsd": 4
      },
      {
        "name": "DIMERO D",
        "priceUsd": 15
      },
      {
        "name": "ECOCARDIOGRAMA",
        "priceUsd": 80
      },
      {
        "name": "ECOGRAFIA CEREBRAL",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA DE MAMA",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA DOPPLER CUALQUIER ORGANO O ESTRUCTURA",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA MUSCULO ESQUELETICO O ARTICULAR",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA OBSTETRICA",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA OCULAR",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA PELVICA GINECOLOGICA",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA PROSTATA SIMPLE / TRANSVESICAL /TRANSRECTAL",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA SIMPLE CUALQUIER ORGANO O ESTRUCTURA",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA TEJIDOS BLANDOS",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA TESTICULAR",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA TIROIDES",
        "priceUsd": 35
      },
      {
        "name": "ECOGRAFIA TRANSVAGINAL",
        "priceUsd": 35
      },
      {
        "name": "ELECTROCARDIOGRAMA",
        "priceUsd": 25
      },
      {
        "name": "ELECTROLITOS EN ORINA 24 HORAS",
        "priceUsd": 15
      },
      {
        "name": "ELECTROLITOS EN ORINA PARCIAL",
        "priceUsd": 15
      },
      {
        "name": "ELECTROLITOS EN SANGRE",
        "priceUsd": 15
      },
      {
        "name": "EPSTEIN BARR VIRUS IGG",
        "priceUsd": 12
      },
      {
        "name": "EPSTEIN BARR VIRUS IGM",
        "priceUsd": 12
      },
      {
        "name": "ESTRADIOL",
        "priceUsd": 12
      },
      {
        "name": "ESTROGENO",
        "priceUsd": 12
      },
      {
        "name": "EXAMEN DE HECES SIMPLE",
        "priceUsd": 5
      },
      {
        "name": "EXAMEN DE ORINA SIMPLE",
        "priceUsd": 6
      },
      {
        "name": "EXTRACCION CUERPO EXTRANO CONDUCTO AUDITIVO EXTERNO SIN INCISION",
        "priceUsd": 35
      },
      {
        "name": "FERRITINA",
        "priceUsd": 12
      },
      {
        "name": "FIBRINOGENO",
        "priceUsd": 6
      },
      {
        "name": "FISIATRIA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "FOSFATASA ALCALINA",
        "priceUsd": 5.5
      },
      {
        "name": "FOSFORO EN ORINA",
        "priceUsd": 5
      },
      {
        "name": "FSH (HORMONA FOLICULO ESTIMULANTE)",
        "priceUsd": 12
      },
      {
        "name": "GAMMA GLUTAMIL TRANSPEPTIDASA (GGTP)",
        "priceUsd": 8
      },
      {
        "name": "GINECOLOGIA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "GINECOLOGIA CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "GINECOLOGIA Y OBSTETRICIA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "GINECOLOGIA Y OBSTETRICIA CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "GLUCOSA (GLICEMIA)",
        "priceUsd": 5
      },
      {
        "name": "GLUCOSA PRE Y POST PRANDIAL",
        "priceUsd": 15
      },
      {
        "name": "GONADOTROPINA CORIONICA HCG CUALITATIVA",
        "priceUsd": 5
      },
      {
        "name": "GONADOTROPINA CORIONICA HCG CUANTITATIVA",
        "priceUsd": 12
      },
      {
        "name": "GOTA GRUESA (PALUDISMO)",
        "priceUsd": 5
      },
      {
        "name": "GRUPO SANGUINEO ABO Y FACTOR RH",
        "priceUsd": 4
      },
      {
        "name": "HELICOBACTER PYLORI ANTICUERPOS IGG IGM E IGA",
        "priceUsd": 15
      },
      {
        "name": "HEMATOLOGIA COMPLETA + PLAQUETAS",
        "priceUsd": 5
      },
      {
        "name": "HEMOGLOBINA GLICOSILADA",
        "priceUsd": 12
      },
      {
        "name": "HERPES SIMPLEX 1 IGG",
        "priceUsd": 12
      },
      {
        "name": "HERPES SIMPLEX 1 IGM",
        "priceUsd": 15
      },
      {
        "name": "HOLTER",
        "priceUsd": 70
      },
      {
        "name": "HORMONA DE CRECIMIENTO (HGH)",
        "priceUsd": 15
      },
      {
        "name": "INMUNOGLOBULINA IGA",
        "priceUsd": 12
      },
      {
        "name": "INMUNOGLOBULINA IGE",
        "priceUsd": 12
      },
      {
        "name": "INMUNOGLOBULINA IGG",
        "priceUsd": 12
      },
      {
        "name": "INMUNOGLOBULINA IGM",
        "priceUsd": 10
      },
      {
        "name": "INSULINA",
        "priceUsd": 10
      },
      {
        "name": "LAVADO DE OIDOS Y ASPIRACION UNILATERAL",
        "priceUsd": 35
      },
      {
        "name": "LH HORMONA LUTEINIZANTE",
        "priceUsd": 12
      },
      {
        "name": "LIPASA",
        "priceUsd": 12
      },
      {
        "name": "MAGNESIO EN ORINA",
        "priceUsd": 6
      },
      {
        "name": "MAGNESIO EN SANGRE",
        "priceUsd": 6
      },
      {
        "name": "MAPA MONITOREO DE TENSION ARTERIAL POR 24 HORAS",
        "priceUsd": 75
      },
      {
        "name": "MEDICINA INTERNA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "MEDICINA INTERNA CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "MICROALBUMINURIA",
        "priceUsd": 12
      },
      {
        "name": "NEFROLOGIA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "NEFROLOGIA CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "OTORRINOLARINGOLOGIA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "OTORRINOLARINGOLOGIA CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "PEDIATRIA GENERAL CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "PEDIATRIA GENERAL CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "PEPTIDO C EN SANGRE",
        "priceUsd": 13
      },
      {
        "name": "PERFIL 20",
        "priceUsd": 30
      },
      {
        "name": "PERFIL ANEMIA",
        "priceUsd": 30
      },
      {
        "name": "PERFIL DE COAGULACION",
        "priceUsd": 8
      },
      {
        "name": "PERFIL HEPATICO",
        "priceUsd": 20
      },
      {
        "name": "PERFIL HORMONAL FEMENINO",
        "priceUsd": 35
      },
      {
        "name": "PERFIL HORMONAL MASCULINO",
        "priceUsd": 41
      },
      {
        "name": "PERFIL LIPIDICO",
        "priceUsd": 15
      },
      {
        "name": "PERFIL PRE NATAL",
        "priceUsd": 30
      },
      {
        "name": "PERFIL PRE OPERATORIO",
        "priceUsd": 20
      },
      {
        "name": "PERFIL RENAL",
        "priceUsd": 9
      },
      {
        "name": "PERFIL REUMATOLOGICO",
        "priceUsd": 12
      },
      {
        "name": "PERFIL TIROIDEO",
        "priceUsd": 30
      },
      {
        "name": "POTASIO EN ORINA PARCIAL",
        "priceUsd": 5
      },
      {
        "name": "POTASIO EN SANGRE",
        "priceUsd": 5
      },
      {
        "name": "PROCALCITONINA",
        "priceUsd": 15
      },
      {
        "name": "PROGESTERONA",
        "priceUsd": 12
      },
      {
        "name": "PROLACTINA",
        "priceUsd": 12
      },
      {
        "name": "PROTEINA C REACTIVA CUANTITATIVA",
        "priceUsd": 6
      },
      {
        "name": "PROTEINA C REACTIVA ULTRASENSIBLE",
        "priceUsd": 6
      },
      {
        "name": "PROTEINAS EN ORINA DE 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "PROTEINAS TOTALES Y FRACCIONADAS",
        "priceUsd": 4
      },
      {
        "name": "PT (TIEMPO DE PROTROMBINA)",
        "priceUsd": 4
      },
      {
        "name": "PTT (TIEMPO DE TROMBOPLASTINA)",
        "priceUsd": 4.5
      },
      {
        "name": "RELACION AC URICO CREATININA EN ORINA DE 24 HORAS",
        "priceUsd": 7
      },
      {
        "name": "RELACION AC URICO CREATININA EN ORINA PARCIAL",
        "priceUsd": 5
      },
      {
        "name": "REUMATOLOGIA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "REUMATOLOGIA CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "RX ARTICULACION 1 PROYECCION",
        "priceUsd": 30
      },
      {
        "name": "RX ARTICULACION 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "RX ARTICULACION 3 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "RX ARTICULACION 4 PROYECCIONES",
        "priceUsd": 45
      },
      {
        "name": "RX ARTICULACION 5 PROYECCIONES",
        "priceUsd": 50
      },
      {
        "name": "RX ARTICULACION 6 PROYECCIONES",
        "priceUsd": 60
      },
      {
        "name": "RX COLUMNA CERVICAL 1 PROYECCION",
        "priceUsd": 35
      },
      {
        "name": "RX COLUMNA CERVICAL 2 PROYECCIONES",
        "priceUsd": 30
      },
      {
        "name": "RX COLUMNA CERVICAL 3 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "RX COLUMNA CERVICAL 4 PROYECCIONES",
        "priceUsd": 45
      },
      {
        "name": "RX COLUMNA CERVICAL 5 PROYECCIONES",
        "priceUsd": 50
      },
      {
        "name": "RX COLUMNA CERVICAL 6 PROYECCIONES",
        "priceUsd": 60
      },
      {
        "name": "RX COLUMNA DORSAL 3 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "RX COLUMNA DORSAL 4 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "RX COLUMNA LUMBAR 1 PROYECCION",
        "priceUsd": 30
      },
      {
        "name": "RX COLUMNA LUMBAR 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "RX COLUMNA LUMBAR 3 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "RX COLUMNA LUMBAR 4 PROYECCIONES",
        "priceUsd": 45
      },
      {
        "name": "RX TORAX 1 PROYECCION",
        "priceUsd": 30
      },
      {
        "name": "RX TORAX 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "RX TORAX 3 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "RX TORAX 4 PROYECCIONES",
        "priceUsd": 45
      },
      {
        "name": "SANGRE OCULTA EN HECES",
        "priceUsd": 6
      },
      {
        "name": "SATURACION DE TRANSFERRINA",
        "priceUsd": 10
      },
      {
        "name": "SODIO EN ORINA DE 24 HORAS",
        "priceUsd": 5
      },
      {
        "name": "SODIO EN SANGRE",
        "priceUsd": 5
      },
      {
        "name": "SODIO POTASIO",
        "priceUsd": 10
      },
      {
        "name": "T3 LIBRE",
        "priceUsd": 10
      },
      {
        "name": "T3 TOTAL",
        "priceUsd": 10
      },
      {
        "name": "T4 TOTAL",
        "priceUsd": 10
      },
      {
        "name": "TERAPIA FISICA / REHABILITACION 10 SESIONES",
        "priceUsd": 250
      },
      {
        "name": "TERAPIA FISICA / REHABILITACION 5 SESIONES",
        "priceUsd": 125
      },
      {
        "name": "TESTOSTERONA LIBRE",
        "priceUsd": 13
      },
      {
        "name": "TESTOSTERONA TOTAL",
        "priceUsd": 10
      },
      {
        "name": "TIROGLOBULINA EN SANGRE",
        "priceUsd": 16
      },
      {
        "name": "TORCH IGG E IGM / TOXOPLASMA GONDII IGG E IGM / RUBEOLA IGG E IGM / CITOMEGALOVIRUS IGG E IGM",
        "priceUsd": 15
      },
      {
        "name": "TRANSAMINASA PIRUVICA TGP SGPT (ALT)",
        "priceUsd": 8
      },
      {
        "name": "TRANSFERRINA EN SANGRE",
        "priceUsd": 12
      },
      {
        "name": "TRAUMATOLOGIA Y ORTOPEDIA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "TRAUMATOLOGIA Y ORTOPEDIA CONSULTA DE CONTROL",
        "priceUsd": 25
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 4
      },
      {
        "name": "TROPONINA",
        "priceUsd": 15
      },
      {
        "name": "TSH HORMONA ESTIMULANTE DE LA TIROIDES",
        "priceUsd": 12
      },
      {
        "name": "UREA EN ORINA",
        "priceUsd": 4
      },
      {
        "name": "UREA EN SANGRE",
        "priceUsd": 4
      },
      {
        "name": "UROCULTIVO Y ANTIBIOGRAMA",
        "priceUsd": 15
      },
      {
        "name": "UROLOGIA CONSULTA 1A VEZ",
        "priceUsd": 25
      },
      {
        "name": "VDRL CUALITATIVO",
        "priceUsd": 4
      },
      {
        "name": "VITAMINA B12",
        "priceUsd": 12
      },
      {
        "name": "VITAMINA D",
        "priceUsd": 12
      },
      {
        "name": "VSG (VELOCIDAD DE SEDIMENTACION GLOBULAR)",
        "priceUsd": 4
      }
    ]
  },
  {
    "name": "OCEANICA DE SEGUROS, C.A",
    "aliases": [],
    "rif": null,
    "services": [
      {
        "name": "ACIDO URICO",
        "priceUsd": 3
      },
      {
        "name": "ACIDO URICO EN ORINA 24 HORAS",
        "priceUsd": 4
      },
      {
        "name": "ALFA FETOPROTEINA MATERNA",
        "priceUsd": 12
      },
      {
        "name": "AMILASA",
        "priceUsd": 8
      },
      {
        "name": "AMILASA EN ORINA DE 24 HORAS",
        "priceUsd": 5
      },
      {
        "name": "ANTICUERPOS ANTI DNA CADENA DOBLE",
        "priceUsd": 18
      },
      {
        "name": "ANTICUERPOS ANTI TIROIDEOS -MICROSAMALES- IHA",
        "priceUsd": 14
      },
      {
        "name": "ANTIGENO CARCINOEMBRIONARIO -ACE-CEA-",
        "priceUsd": 12
      },
      {
        "name": "ANTIGENO DE CANCER 125 -CA 125-",
        "priceUsd": 13
      },
      {
        "name": "ANTIGENO DE CANCER 15-3 -CA 15-3-",
        "priceUsd": 13
      },
      {
        "name": "ANTIGENO DE CANCER 19-9 -CA 19-9-",
        "priceUsd": 13
      },
      {
        "name": "ANTIGENO ESPECIFICO DE PROSTATA AEP PSA-",
        "priceUsd": 6
      },
      {
        "name": "ANTIGENO ESPECIFICO DE PROSTATA FRACCION LIBRE",
        "priceUsd": 6
      },
      {
        "name": "ARTICULACION 1 PROYECCION",
        "priceUsd": 30
      },
      {
        "name": "ARTICULACION 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "ARTICULACION 3 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "ARTICULACION 4 PROYECCIONES",
        "priceUsd": 45
      },
      {
        "name": "ARTICULACION 5 PROYECCIONES",
        "priceUsd": 50
      },
      {
        "name": "ARTICULACION 6 PROYECCIONES",
        "priceUsd": 60
      },
      {
        "name": "BILIRRUBINA TOTAL",
        "priceUsd": 4
      },
      {
        "name": "BILIRRUBINA TOTAL Y DIRECTA",
        "priceUsd": 7
      },
      {
        "name": "BIOPSIA MAS COLPOSCOPIA (VULVOSCOPIA)",
        "priceUsd": 120
      },
      {
        "name": "CALCIO",
        "priceUsd": 6
      },
      {
        "name": "CALCIO EN ORINA DE 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "CAPACIDAD TOTAL DE FIJACION DEL HIERRO -TIBC TOTAL IRON-BINDING CAPACITY -",
        "priceUsd": 2
      },
      {
        "name": "CARDIOLIPINAS FOSFOLIPIDOS PRUEBA CUANTITATIVA ANTICUR TIPO IGA IGG E IGM EIA",
        "priceUsd": 18
      },
      {
        "name": "CHLAMYDIA TRACHOMATIS ANTICUERPOS IGG EIA",
        "priceUsd": 9
      },
      {
        "name": "CITOLOGIA GINECOLOGICA ©",
        "priceUsd": 25
      },
      {
        "name": "CLORO EN ORINA DE 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "COLESTEROL ALTA DENSIDAD -HDL-",
        "priceUsd": 4
      },
      {
        "name": "COLESTEROL BAJA DENSIDAD -LDL- CALCULADO ENZIMATICO",
        "priceUsd": 4
      },
      {
        "name": "COLESTEROL TOTAL",
        "priceUsd": 4
      },
      {
        "name": "COLESTEROL TOTAL Y SUS FRACCIONES",
        "priceUsd": 16
      },
      {
        "name": "COLESTEROL V L D L",
        "priceUsd": 4
      },
      {
        "name": "COLPOSCOPIA",
        "priceUsd": 60
      },
      {
        "name": "COLPOSCOPIA (VAGINOSCOPIA)",
        "priceUsd": 70
      },
      {
        "name": "COLUMNA CERVICAL (A.P. LATERAL/OBLICUAS)",
        "priceUsd": 40
      },
      {
        "name": "COLUMNA CERVICAL (AP YLATERAL )",
        "priceUsd": 35
      },
      {
        "name": "COLUMNA CERVICAL (LATERAL EN CAMA)",
        "priceUsd": 30
      },
      {
        "name": "COLUMNA CERVICAL (SOLO OBLICUAS)",
        "priceUsd": 35
      },
      {
        "name": "COLUMNA CERVICAL 3 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "COLUMNA CERVICAL 4 PROYECC.",
        "priceUsd": 45
      },
      {
        "name": "COLUMNA CERVICAL 5 PROYECCIONES",
        "priceUsd": 50
      },
      {
        "name": "COLUMNA CERVICAL 6 PROYECCIONES",
        "priceUsd": 60
      },
      {
        "name": "COLUMNA DORSAL 2 PROYECCIONE",
        "priceUsd": 35
      },
      {
        "name": "COLUMNA DORSO LUMBAR AP",
        "priceUsd": 40
      },
      {
        "name": "COLUMNA DORSO-LUMBAR",
        "priceUsd": 40
      },
      {
        "name": "COLUMNA LUMBAR 1 PROYECCION",
        "priceUsd": 30
      },
      {
        "name": "COLUMNA LUMBAR 2 PROYECCION",
        "priceUsd": 35
      },
      {
        "name": "COLUMNA LUMBAR 3 PROYECCION",
        "priceUsd": 40
      },
      {
        "name": "COLUMNA LUMBAR 4 PROYECCION",
        "priceUsd": 45
      },
      {
        "name": "COLUMNA LUMBOSACRA",
        "priceUsd": 35
      },
      {
        "name": "COMPLEMENTO SERICO FRACCION 3 -C3- IDR",
        "priceUsd": 13
      },
      {
        "name": "COMPLEMENTO SERICO-FRACCION 4- C4- IDR",
        "priceUsd": 13
      },
      {
        "name": "COMPLEMENTO TOTAL HEMOLITICO- CH50-",
        "priceUsd": 18
      },
      {
        "name": "CONSULTA: CARDIOLOGIA",
        "priceUsd": 25
      },
      {
        "name": "CONSULTA: CIRUGIA GENERAL",
        "priceUsd": 25
      },
      {
        "name": "CONSULTA: FISIATRIA",
        "priceUsd": 25
      },
      {
        "name": "CONSULTA: MEDICINA INTERNA",
        "priceUsd": 25
      },
      {
        "name": "CONSULTA: NEFROLOGIA",
        "priceUsd": 25
      },
      {
        "name": "CONSULTA: OTORRINOLARINGOLOGIA",
        "priceUsd": 25
      },
      {
        "name": "CONSULTA: REUMATOLOGIA",
        "priceUsd": 25
      },
      {
        "name": "CONSULTA: UROLOGÍA",
        "priceUsd": 25
      },
      {
        "name": "CORTISOL",
        "priceUsd": 11
      },
      {
        "name": "CREATIN QUINASA FRACCION CARDIACA - CK-MB-POR MASA",
        "priceUsd": 11
      },
      {
        "name": "CREATIN QUINASA TOTAL-CK-CPK-",
        "priceUsd": 9
      },
      {
        "name": "CREATININA",
        "priceUsd": 3
      },
      {
        "name": "CREATININA EN ORINA DE 24 HORAS",
        "priceUsd": 4
      },
      {
        "name": "CULTIVO DE MATERIA FECAL -COPROCULTIVO- INCLUYE IDENTIFICACION Y ANTIBIOGRAMA",
        "priceUsd": 20
      },
      {
        "name": "CULTIVO ISOLACTER CACTERIA HONGO BK",
        "priceUsd": 8
      },
      {
        "name": "CULTIVO ORINA",
        "priceUsd": 18
      },
      {
        "name": "CULTIVO SECRECION BRONQUIAL",
        "priceUsd": 12
      },
      {
        "name": "CURVA DE GLICEMIA INSULINA 3 HORAS CON 100GR DE GLUCOSA",
        "priceUsd": 25
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA 2 HRS CON 75 GRAMOS DE GLUCOSA",
        "priceUsd": 20
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA BASAL Y POSTPANDRIAL/2 HRS",
        "priceUsd": 15
      },
      {
        "name": "CURVA DE GLICEMIA-INSULINA CINCO HORAS",
        "priceUsd": 30
      },
      {
        "name": "DENGUE ANTICUERPOS IG G",
        "priceUsd": 7
      },
      {
        "name": "DENGUE ANTICUERPOS IG M",
        "priceUsd": 7
      },
      {
        "name": "DEPURACION DE CREATININA",
        "priceUsd": 6
      },
      {
        "name": "DESHIDROGENASA LACTICA -LDH-",
        "priceUsd": 4
      },
      {
        "name": "DIMERO D EIA",
        "priceUsd": 26
      },
      {
        "name": "ECOCARDIOGRAMA",
        "priceUsd": 70
      },
      {
        "name": "ECOGRAFIA ABDOMINAL",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA ARTICULAR",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA CADERA PEDIATRICA.",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA CEREBRAL",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA DE CADERA UNILATERAL",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA DE MAMA",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA DE VEJIGA",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA ENCEFALOGRAMA",
        "priceUsd": 80
      },
      {
        "name": "ECOGRAFIA ESPLENICO",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA HOMBRO.",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA MUSCULO ESQUEL",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA OBSTETRICA.",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA OJO.",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA PANCREATICO",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA PELVICA O GINECOLOGICA.",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA PELVICO TRANPERIANAL",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA PROSTATA",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA PROSTATICO TRANSVESICAL",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA RENAL",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA RIQONES.",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA RODILLA.",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA SUPRARENAL",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA SUPRARRENAL",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA TEJIDOS BLANDOS.",
        "priceUsd": 40
      },
      {
        "name": "ECOGRAFIA TESTICULO.",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA TIROIDEO",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA TIROIDES",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA TRANSRECTAL PARA MUCOSA",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA TRANSVAGINAL",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA VESICAL (VEJIGA)",
        "priceUsd": 30
      },
      {
        "name": "ECOGRAFIA VIAS URINARIAS (RIQONES, VEJIGA Y PROSTATA TRANSABDOMINAL)",
        "priceUsd": 40
      },
      {
        "name": "ELECTROCARDIOGRAMA",
        "priceUsd": 25
      },
      {
        "name": "ELECTROLITOS 24 HORAS",
        "priceUsd": 14
      },
      {
        "name": "ELECTROLITOS NA K CL EN ORINA",
        "priceUsd": 14
      },
      {
        "name": "ELECTROLITOS SANGRE ORINA",
        "priceUsd": 14
      },
      {
        "name": "EPSTEIN-BARR ANTICUERPOS IGG CONTRA EL ANTIGENO CAPSULAR VCA-G IFI",
        "priceUsd": 12
      },
      {
        "name": "EPSTEIN-BARR ANTICUERPOS IGM CONTRA EL ANTIGENO CAPSULAR VCA-M IFI",
        "priceUsd": 12
      },
      {
        "name": "ESTRADIOL",
        "priceUsd": 11
      },
      {
        "name": "ESTROGENOS",
        "priceUsd": 12
      },
      {
        "name": "EXTRACCION CUERPO EXTRANO CONDUCTO AUDITIVO EXTERNO, SIN INCISION",
        "priceUsd": 45
      },
      {
        "name": "FERRITINA",
        "priceUsd": 10
      },
      {
        "name": "FIBRINOGENO POR COAGULACION",
        "priceUsd": 6
      },
      {
        "name": "FOSFATASA ALCALINA",
        "priceUsd": 5
      },
      {
        "name": "FOSFORO INORGANICO -FOSFATOS- EN ORINA DE 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "GAMA GLUTAMIL TRANSFERASA-GGT-",
        "priceUsd": 8
      },
      {
        "name": "GINECOLOGIA Y OBSTETRICIA",
        "priceUsd": 25
      },
      {
        "name": "GLUCOSA BASAL O POST C U",
        "priceUsd": 5
      },
      {
        "name": "GONADOTROPINA CORIONICA SUB-UNIDAD BETA CUALITATIVA-PRUEBA DE EMBARAZO",
        "priceUsd": 5
      },
      {
        "name": "GONODOTROPINACORIONICA SUBUNIDAD BETA CUANTITATIVA",
        "priceUsd": 12
      },
      {
        "name": "HECES",
        "priceUsd": 2
      },
      {
        "name": "HELICOBACTER PYLORI ANTICUERPOS IGG IGM E IGA EIA",
        "priceUsd": 16
      },
      {
        "name": "HEMOCLASIFICACION GRUPO SANGUINEO Y FACTOR RH",
        "priceUsd": 4
      },
      {
        "name": "HEMOGLOBINA GLICOSILADA ANTICUERPOS MONOCLONALES",
        "priceUsd": 12
      },
      {
        "name": "HEMOGRAMA TIPO I- (HEMATOLOGIA COMPLETA)",
        "priceUsd": 2
      },
      {
        "name": "HEMOPARASITOS EN GOTA GRUESA",
        "priceUsd": 3.5
      },
      {
        "name": "HEPATITIS A ANTICUERPOS IGM -ANTI-HVA-M-",
        "priceUsd": 10
      },
      {
        "name": "HEPATITIS A ANTICUERPOS TOTALES -ANTI -HVA-",
        "priceUsd": 10
      },
      {
        "name": "HEPATITIS B ANTICUERPOS C IG M -ANTI-HBC-M-",
        "priceUsd": 10
      },
      {
        "name": "HEPATITIS B ANTICUERPOS C TOTALES -ANTI-HBC-",
        "priceUsd": 10
      },
      {
        "name": "HEPATITIS B ANTICUERPOS E -ANTI-HBE-",
        "priceUsd": 10
      },
      {
        "name": "HEPATITIS B ANTIGENO S- AG-HBS-",
        "priceUsd": 10
      },
      {
        "name": "HEPATITIS C ANTICUERPOS -ANTI-HVC-",
        "priceUsd": 10
      },
      {
        "name": "HERPES SIMPLEX I ANTICUERPOS IG G",
        "priceUsd": 13
      },
      {
        "name": "HERPES SIMPLEX I ANTICUERPOS IG M",
        "priceUsd": 13
      },
      {
        "name": "HOLTER",
        "priceUsd": 75
      },
      {
        "name": "HOMBRO 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "HOMBRO AMBOS 2 PROYECCIONES",
        "priceUsd": 70
      },
      {
        "name": "HORMONA ESTIMULANTE DEL TIROIDES -TSH-",
        "priceUsd": 10
      },
      {
        "name": "HORMONA FOLICULO ESTIMULANTE -FSH-",
        "priceUsd": 10
      },
      {
        "name": "HORMONA LUTEINIZANTE -LH-",
        "priceUsd": 10
      },
      {
        "name": "INMUNOGLOBULINA A -IGA- IDR",
        "priceUsd": 10
      },
      {
        "name": "INMUNOGLOBULINA E TOTAL -IG E- RIA EIA",
        "priceUsd": 10
      },
      {
        "name": "INMUNOGLOBULINA G -IG G- IDR",
        "priceUsd": 10
      },
      {
        "name": "INMUNOGLOBULINA M -IG M- IDR",
        "priceUsd": 10
      },
      {
        "name": "INSULINA LIBRE",
        "priceUsd": 9
      },
      {
        "name": "LAVADO DE OIDOS",
        "priceUsd": 45
      },
      {
        "name": "LIPASA",
        "priceUsd": 10
      },
      {
        "name": "MAGNESIO",
        "priceUsd": 4
      },
      {
        "name": "MAGNESIO EN ORINA",
        "priceUsd": 7
      },
      {
        "name": "MANO 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "MANO AMBAS 2 PROYECCIONES",
        "priceUsd": 70
      },
      {
        "name": "MICROALBUMINURIA NEFELOMETRIA",
        "priceUsd": 10
      },
      {
        "name": "MONITOREO DE TENSION ARTERIAL POR 24 HORAS (MAPA)",
        "priceUsd": 80
      },
      {
        "name": "MUÑECA 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "MUÑECA AMBAS 2 PROYECCIONES",
        "priceUsd": 70
      },
      {
        "name": "MYCOPLASMA PNEUMONIAE ANTICUERPOS IG G",
        "priceUsd": 10
      },
      {
        "name": "MYCOPLASMA PNEUMONIAE ANTICUERPOS IG M",
        "priceUsd": 10
      },
      {
        "name": "ORINA CADA MUESTRA",
        "priceUsd": 2
      },
      {
        "name": "PANORAMICA DE COLUMNA VERTEBRAL",
        "priceUsd": 80
      },
      {
        "name": "PCR PARA HIV",
        "priceUsd": 5
      },
      {
        "name": "PEDIATRIA GENERAL",
        "priceUsd": 25
      },
      {
        "name": "PELVIS AP",
        "priceUsd": 30
      },
      {
        "name": "PEPTIDO C",
        "priceUsd": 11
      },
      {
        "name": "PERFIL ANEMIA I",
        "priceUsd": 32
      },
      {
        "name": "PERFIL COAGULACION",
        "priceUsd": 8
      },
      {
        "name": "PERFIL GENERAL O PERFIL 20",
        "priceUsd": 30
      },
      {
        "name": "PERFIL HEPATICO",
        "priceUsd": 18.5
      },
      {
        "name": "PERFIL HEPATICO COMPLETO",
        "priceUsd": 20
      },
      {
        "name": "PERFIL HEPATITIS B C AGS HB ANTI-CORE ANTI HCV",
        "priceUsd": 23
      },
      {
        "name": "PERFIL HORMONAL FEMENINO",
        "priceUsd": 45
      },
      {
        "name": "PERFIL HORMONAL MASCULINO",
        "priceUsd": 41
      },
      {
        "name": "PERFIL LIPIDICO",
        "priceUsd": 15
      },
      {
        "name": "PERFIL PRE-OPERATORIO",
        "priceUsd": 28
      },
      {
        "name": "PERFIL PRENATAL",
        "priceUsd": 30
      },
      {
        "name": "PERFIL RENAL",
        "priceUsd": 7
      },
      {
        "name": "PERFIL REUMATOLOGICO",
        "priceUsd": 12
      },
      {
        "name": "PERFIL TIROIDEO",
        "priceUsd": 30
      },
      {
        "name": "PIE 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "PIE AMBOS 2 PROYECCIONES",
        "priceUsd": 70
      },
      {
        "name": "POTASIO",
        "priceUsd": 3
      },
      {
        "name": "POTASIO EN ORINA DE 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "PROCALCITONINA SEMICUANTITATIVA",
        "priceUsd": 16
      },
      {
        "name": "PROGESTERONA",
        "priceUsd": 12
      },
      {
        "name": "PROLACTINA -MUESTRA UNICA-",
        "priceUsd": 12
      },
      {
        "name": "PROTEINA C REACTIVA CUANLITATIVA LATEX",
        "priceUsd": 6
      },
      {
        "name": "PROTEINA C REACTIVA CUANTITATIVA NEFELOMETRIA",
        "priceUsd": 6
      },
      {
        "name": "PROTEINA S DE LA COAGULACION TOTAL",
        "priceUsd": 3
      },
      {
        "name": "PROTEINURIA PARCIAL",
        "priceUsd": 7
      },
      {
        "name": "RECUENTO MINUTADO ORINA 3 H",
        "priceUsd": 10
      },
      {
        "name": "RELACION ACIDO ALBUMINA/CREATININA",
        "priceUsd": 7
      },
      {
        "name": "RELACION ACIDO CALCIO/CREATININA",
        "priceUsd": 6
      },
      {
        "name": "RELACION ACIDO FOSFORO/CREATININA",
        "priceUsd": 7
      },
      {
        "name": "RELACION ACIDO MAGNESIO/CREATININA",
        "priceUsd": 7
      },
      {
        "name": "RELACION ACIDO URICO CRATININA PARC",
        "priceUsd": 7
      },
      {
        "name": "RELACION DE ACIDO URICO CREATININA 24 HORAS",
        "priceUsd": 6
      },
      {
        "name": "RODILLA 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "RODILLA AMBAS 2 PROYECCIONES",
        "priceUsd": 70
      },
      {
        "name": "SANGRE OCULTA FECALES-PRUEBA GUAYACO O EQUIVALENTE",
        "priceUsd": 3
      },
      {
        "name": "SATURACION DE LA TRANSFERRINA -INCLUYE DETERMINACION DE HIERRO SERICO CAPACIDAD TOTAL DE",
        "priceUsd": 10
      },
      {
        "name": "SENOS PARANASALES",
        "priceUsd": 40
      },
      {
        "name": "SODIO",
        "priceUsd": 5
      },
      {
        "name": "SODIO EN ORINA",
        "priceUsd": 6
      },
      {
        "name": "SODIO POTASIO",
        "priceUsd": 12
      },
      {
        "name": "TESTOSTERONA LIBRE",
        "priceUsd": 11
      },
      {
        "name": "TESTOSTERONA TOTAL",
        "priceUsd": 12
      },
      {
        "name": "TIEMPO DE PROTOMBINA PT",
        "priceUsd": 4
      },
      {
        "name": "TIEMPO PARCIAL DE TROMBOPLASTINA TPT",
        "priceUsd": 4.5
      },
      {
        "name": "TIROGLOBULINA",
        "priceUsd": 14
      },
      {
        "name": "TIROXINA TOTAL -T4 TOTAL-",
        "priceUsd": 10
      },
      {
        "name": "TOBILLO 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "TOBILLO AMBOS 2 PROYECCIONES",
        "priceUsd": 70
      },
      {
        "name": "TORAX 1 PROYECCION",
        "priceUsd": 30
      },
      {
        "name": "TORAX 2 PROYECCIONES",
        "priceUsd": 35
      },
      {
        "name": "TORAX 3 PROYECCIONES",
        "priceUsd": 40
      },
      {
        "name": "TORAX 4 PROYECCIONES",
        "priceUsd": 45
      },
      {
        "name": "TORCH IGG E IGM -TOXOPLASMA GONDII IGG E IGM RUBEOLA IGG E IGM CITOMEGALOVIRUS IGG E IGM",
        "priceUsd": 18
      },
      {
        "name": "TOXOPLASMA GONDI ANTICUERPOS IG G EIA",
        "priceUsd": 6
      },
      {
        "name": "TOXOPLASMA GONDII ANTICUERPOS IG M EIA",
        "priceUsd": 6
      },
      {
        "name": "TRANSAMINASA PIRUVICA ALAT",
        "priceUsd": 4
      },
      {
        "name": "TRANSFERRINA IDR",
        "priceUsd": 11
      },
      {
        "name": "TRAUMATOLOGIA Y ORTOPEDIA",
        "priceUsd": 25
      },
      {
        "name": "TRIGLICERIDOS",
        "priceUsd": 2
      },
      {
        "name": "TRIYODOTIRONINA LIBRE -T3L-",
        "priceUsd": 10
      },
      {
        "name": "TRIYODOTIRONINA TOTAL -T3 TOTAL -",
        "priceUsd": 10
      },
      {
        "name": "TROPONINA T CUALITATIVA -PRUEBA RAPIDA-",
        "priceUsd": 14
      },
      {
        "name": "UREA",
        "priceUsd": 2
      },
      {
        "name": "UREA EN ORINA",
        "priceUsd": 3
      },
      {
        "name": "UREA EN SANGRE",
        "priceUsd": 2
      },
      {
        "name": "UROANALISIS-CITOQUIMICO DE ORINA- INCLUYE QUIMICA POR CUALQUIER METODO Y SEDIMENTO",
        "priceUsd": 4
      },
      {
        "name": "VDRL CUALITATIVIO",
        "priceUsd": 3
      },
      {
        "name": "VITAMINA B-12",
        "priceUsd": 14
      },
      {
        "name": "VITAMINA D 1 25-DIHIDROXI",
        "priceUsd": 18
      },
      {
        "name": "VSG",
        "priceUsd": 3
      }
    ]
  }
];
