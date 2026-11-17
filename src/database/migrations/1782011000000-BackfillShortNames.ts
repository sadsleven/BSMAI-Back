import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Carga inicial de nombres cortos para los seguros y centros que vienen del
 * seeder de baremos. Sólo escribe donde `shortName` está vacío, así que es
 * idempotente y nunca pisa lo que el usuario haya puesto desde el catálogo.
 * El match es por nombre normalizado (sin acentos, sin puntuación, una sola
 * secuencia de espacios) porque las razones sociales del seeder tienen comas,
 * puntos y acentos que varían.
 */

/** Razón social normalizada → nombre corto. */
const INSURANCES: Array<[string, string]> = [
  ['CNA SEGUROS LA PREVISORA', 'PREVISORA'],
  ['SEGUROS ALTAMIRA CA', 'ALTAMIRA'],
  ['ESTAR SEGUROS SA', 'ESTAR SEGUROS'],
  ['SEGUROS CONSTITUCION CA', 'CONSTITUCIÓN'],
  ['ENVIASISTENCIA', 'ENVIASISTENCIA'],
  ['HISPANA DE SEGUROS SA', 'HISPANA'],
  ['SEGUROS VENEZUELA CA', 'VENEZUELA'],
  ['SEGUROS UNIVERSITAS CA', 'UNIVERSITAS'],
  ['SEGUROS PIRAMIDE CA', 'PIRÁMIDE'],
  ['OCEANICA DE SEGUROS CA', 'OCEÁNICA'],
];

const CARE_CENTERS: Array<[string, string]> = [
  ['LABORATORIO CLINICO RISLAB ORIENTE CA', 'RISLAB'],
  ['UNIDAD RADIOLOGICA DE IMAGENES MEDICAS CA URIMECA', 'URIMECA'],
  ['CIMA CA', 'CIMA'],
];

/**
 * Normaliza igual que el match de arriba: mayúsculas, sin acentos, sólo
 * letras/números/espacios. `unaccent` no está instalado, así que se hace con
 * `translate` sobre las vocales acentuadas y la ñ.
 */
const NORM = (col: string): string =>
  `regexp_replace(UPPER(translate(${col}, 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÃÕÑÇáéíóúàèìòùäëïöüâêîôûãõñç', 'AEIOUAEIOUAEIOUAEIOUAONCaeiouaeiouaeiouaeiouaonc')), '[^A-Z0-9 ]', '', 'g')`;

export class BackfillShortNames1782011000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [normalized, short] of INSURANCES) {
      await queryRunner.query(
        `UPDATE "insurances"
            SET "shortName" = $1
          WHERE COALESCE("shortName", '') = ''
            AND regexp_replace(${NORM('"name"')}, '\\s+', ' ', 'g') = $2`,
        [short, normalized],
      );
    }
    for (const [normalized, short] of CARE_CENTERS) {
      await queryRunner.query(
        `UPDATE "care_centers"
            SET "shortName" = $1
          WHERE COALESCE("shortName", '') = ''
            AND regexp_replace(${NORM('"businessName"')}, '\\s+', ' ', 'g') = $2`,
        [short, normalized],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir sólo los valores que esta migración pudo haber puesto.
    await queryRunner.query(
      `UPDATE "insurances" SET "shortName" = NULL WHERE "shortName" = ANY($1)`,
      [INSURANCES.map(([, s]) => s)],
    );
    await queryRunner.query(
      `UPDATE "care_centers" SET "shortName" = NULL WHERE "shortName" = ANY($1)`,
      [CARE_CENTERS.map(([, s]) => s)],
    );
  }
}
