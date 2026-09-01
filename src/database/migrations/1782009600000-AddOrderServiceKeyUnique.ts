import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clave de servicio (autorización del seguro): índice de apoyo, NO único.
 *
 * La regla de negocio ("una clave no se repite entre órdenes vivas; sólo
 * vuelve a quedar libre si la orden que la tenía se cancela") se valida en la
 * aplicación (`OrdersService.assertServiceKeyAvailable` + chequeo en vivo del
 * Paso 1). **No hay UNIQUE en la base**: los datos históricos ya traen claves
 * repetidas y un índice único no se puede crear sobre ellas ni debe bloquear
 * la edición de esas órdenes viejas.
 *
 * El índice parcial sirve al chequeo de disponibilidad (búsqueda por clave
 * entre órdenes no canceladas). Las órdenes en papelera (`deletedAt`) SIGUEN
 * ocupando su clave: se pueden restaurar.
 */
export class AddOrderServiceKeyUnique1782009600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normaliza restos vacíos: '' equivale a "sin clave".
    await queryRunner.query(
      `UPDATE "orders" SET "serviceKey" = NULL WHERE "serviceKey" IS NOT NULL AND btrim("serviceKey") = ''`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_orders_service_key_active"
         ON "orders" ("serviceKey")
       WHERE "serviceKey" IS NOT NULL AND "status" <> 'cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_service_key_active"`);
  }
}
