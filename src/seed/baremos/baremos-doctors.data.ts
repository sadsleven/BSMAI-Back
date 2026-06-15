/**
 * AUTO-GENERADO por scripts/parse-baremos.js a partir de
 * /baremos/BAREMOS PARTICULAR.xlsx. NO editar a mano.
 * Regenerar: `node scripts/parse-baremos.js`.
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

export const BAREMO_DOCTORS: BaremoDoctorSeed[] = [
  {
    "firstName": "OSCAR",
    "lastName": "BRUZUAL",
    "cedula": "SIN-CED-01",
    "specialtyName": "MEDICINA GENERAL",
    "serviceTypeName": "MEDICINA GENERAL",
    "priceUsd": 20
  },
  {
    "firstName": "JUAN",
    "lastName": "CANADEL",
    "cedula": "SIN-CED-02",
    "specialtyName": "MEDICINA GENERAL",
    "serviceTypeName": "MEDICINA GENERAL",
    "priceUsd": 20
  },
  {
    "firstName": "YAMILETH",
    "lastName": "RINDON",
    "cedula": "SIN-CED-03",
    "specialtyName": "MEDICINA INTERNA",
    "serviceTypeName": "MEDICINA INTERNA",
    "priceUsd": 25
  },
  {
    "firstName": "JOSE",
    "lastName": "MAESTRE",
    "cedula": "SIN-CED-04",
    "specialtyName": "MEDICINA INTERNA",
    "serviceTypeName": "MEDICINA INTERNA",
    "priceUsd": 25
  },
  {
    "firstName": "JOSE",
    "lastName": "PENOTT",
    "cedula": "SIN-CED-05",
    "specialtyName": "MEDICINA INTERNA",
    "serviceTypeName": "MEDICINA INTERNA",
    "priceUsd": 25
  },
  {
    "firstName": "MORELIA",
    "lastName": "RIVERA",
    "cedula": "SIN-CED-06",
    "specialtyName": "FISIATRIA",
    "serviceTypeName": "FISIATRIA",
    "priceUsd": 30
  },
  {
    "firstName": "JOLETHMY",
    "lastName": "ZABALA",
    "cedula": "SIN-CED-07",
    "specialtyName": "TRAUMATOLOGIA",
    "serviceTypeName": "TRAUMATOLOGIA",
    "priceUsd": 40
  },
  {
    "firstName": "LUISA",
    "lastName": "CHALLA",
    "cedula": "SIN-CED-08",
    "specialtyName": "TRAUMATOLOGIA",
    "serviceTypeName": "TRAUMATOLOGIA",
    "priceUsd": 40
  },
  {
    "firstName": "FREDERICK",
    "lastName": "MONTAÑO",
    "cedula": "SIN-CED-09",
    "specialtyName": "NEUROLOGIA",
    "serviceTypeName": "NEUROLOGIA",
    "priceUsd": 50
  },
  {
    "firstName": "LEONARDO",
    "lastName": "REINOZA",
    "cedula": "SIN-CED-10",
    "specialtyName": "NEFROLOGIA",
    "serviceTypeName": "NEFROLOGIA",
    "priceUsd": 40
  },
  {
    "firstName": "TOMAS",
    "lastName": "GRANADO",
    "cedula": "SIN-CED-11",
    "specialtyName": "NEFROLOGIA",
    "serviceTypeName": "NEFROLOGIA",
    "priceUsd": 40
  }
];
