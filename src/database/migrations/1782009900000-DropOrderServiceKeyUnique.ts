import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quita el UNIQUE de la clave de servicio y deja sólo un índice de apoyo.
 *
 * Las bases que alcanzaron a aplicar la versión anterior de
 * `AddOrderServiceKeyUnique1782009600000` tienen el índice único
 * `ux_orders_service_key_active`. Con datos históricos que repiten clave el
 * único bloquea editar esas órdenes (y ni siquiera se puede crear en
 * producción), así que la unicidad pasa a validarse sólo en la aplicación.
 */
export class DropOrderServiceKeyUnique1782009900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "ux_orders_service_key_active"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_orders_service_key_active"
         ON "orders" ("serviceKey")
       WHERE "serviceKey" IS NOT NULL AND "status" <> 'cancelled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_orders_service_key_active"`,
    );
    // Falla si la base tiene claves repetidas entre órdenes vivas (que es
    // justamente el motivo por el que se quitó el único).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_orders_service_key_active"
         ON "orders" ("serviceKey")
       WHERE "serviceKey" IS NOT NULL AND "status" <> 'cancelled'`,
    );
  }
}
