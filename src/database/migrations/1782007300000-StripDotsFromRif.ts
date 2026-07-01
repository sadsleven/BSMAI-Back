import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RIF sin puntos de miles: `J-12.345.678-9` → `J-12345678-9`.
 * La cédula conserva los puntos; sólo el RIF cambia.
 *
 * Afecta las 4 tablas con columna `rif`: patients, insurances, care_centers,
 * doctors. Los índices unique parciales `WHERE rif IS NOT NULL` siguen válidos
 * (quitar puntos no genera colisiones).
 *
 * down() reinserta los puntos según el largo de la base (7 u 8 dígitos):
 *   8 → XX.XXX.XXX   ·   7 → X.XXX.XXX
 */
export class StripDotsFromRif1782007300000 implements MigrationInterface {
  private static readonly TABLES = [
    'patients',
    'insurances',
    'care_centers',
    'doctors',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const t of StripDotsFromRif1782007300000.TABLES) {
      await queryRunner.query(
        `UPDATE "${t}" SET "rif" = REPLACE("rif", '.', '')
         WHERE "rif" IS NOT NULL AND "rif" LIKE '%.%'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of StripDotsFromRif1782007300000.TABLES) {
      await queryRunner.query(
        `UPDATE "${t}" SET "rif" =
           split_part("rif", '-', 1) || '-' ||
           CASE length(split_part("rif", '-', 2))
             WHEN 8 THEN substr(split_part("rif", '-', 2), 1, 2) || '.' ||
                         substr(split_part("rif", '-', 2), 3, 3) || '.' ||
                         substr(split_part("rif", '-', 2), 6, 3)
             WHEN 7 THEN substr(split_part("rif", '-', 2), 1, 1) || '.' ||
                         substr(split_part("rif", '-', 2), 2, 3) || '.' ||
                         substr(split_part("rif", '-', 2), 5, 3)
             ELSE split_part("rif", '-', 2)
           END
           || '-' || split_part("rif", '-', 3)
         WHERE "rif" IS NOT NULL AND "rif" NOT LIKE '%.%' AND "rif" LIKE '%-%-%'`,
      );
    }
  }
}
