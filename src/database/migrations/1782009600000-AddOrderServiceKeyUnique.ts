import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clave de servicio (autorización del seguro) ÚNICA entre órdenes vivas.
 *
 * Una clave no se reutiliza: sólo vuelve a quedar libre si la orden que la
 * tenía fue **cancelada** (misma regla que el N° de orden). Por eso el índice
 * es parcial sobre `status <> 'cancelled'`. Las órdenes en papelera
 * (`deletedAt`) SIGUEN ocupando su clave: se pueden restaurar.
 *
 * `serviceKey` sólo lo persisten las órdenes de seguro y el servicio ya lo
 * guarda con trim (o NULL); el predicado descarta vacíos por si quedó alguno.
 */
export class AddOrderServiceKeyUnique1782009600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normaliza restos vacíos para que no choquen entre sí en el índice.
    await queryRunner.query(
      `UPDATE "orders" SET "serviceKey" = NULL WHERE "serviceKey" IS NOT NULL AND btrim("serviceKey") = ''`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_orders_service_key_active"
         ON "orders" ("serviceKey")
       WHERE "serviceKey" IS NOT NULL AND "status" <> 'cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_orders_service_key_active"`);
  }
}
