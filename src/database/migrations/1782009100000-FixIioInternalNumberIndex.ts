import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice numérico de `order_internal_orders."internalNumber"`.
 *
 * El índice viejo (`idx_iio_internal_number_int`) casteaba a `integer` SIN
 * filtro, así que cualquier valor no numérico en la columna reventaba el UPDATE
 * (la renumeración manual de una orden aparca números temporales) y además el
 * cast no coincidía con las consultas del servicio, que comparan en `bigint`.
 *
 * Se reemplaza por un índice parcial en `bigint` sobre las filas numéricas: lo
 * usan las consultas de numeración (`MAX(...)`, huecos libres) y tolera valores
 * temporales fuera del patrón.
 */
export class FixIioInternalNumberIndex1782009100000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_iio_internal_number_int"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_iio_internal_number_num"
         ON "order_internal_orders" ((("internalNumber")::bigint))
       WHERE "internalNumber" ~ '^[0-9]+$'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_iio_internal_number_num"`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_iio_internal_number_int"
         ON "order_internal_orders" ((("internalNumber")::integer))`,
    );
  }
}
