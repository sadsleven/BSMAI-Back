import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Porciones de orden en Cuentas por cobrar (caso mixto: orden de seguro no
 * indexado con algunos tipos de servicio indexados).
 *
 * `accounts_receivable_orders.portion varchar(8) NOT NULL DEFAULT 'full'`:
 *   - `full`: la orden completa en un solo modo (comportamiento previo).
 *   - `fixed`: porción tasa fija (STs NO indexados) — targetBs a la tasa de la orden.
 *   - `indexed`: porción indexada (STs indexados) — targetUsd a la tasa del día del cobro.
 *
 * Una orden mixta genera 2 pendientes (uno por porción) que viven en lotes de
 * modos distintos. Exclusividad pasa de UNIQUE(orderId) a UNIQUE(orderId, portion);
 * la invariante "full excluye a las porciones y viceversa" la garantiza el service
 * (la composición de la orden es inmutable al finalizar, no puede cambiar de forma).
 *
 * Idempotente vía IF NOT EXISTS / IF EXISTS.
 */
export class AddAroPortion1782008400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_orders"
         ADD COLUMN IF NOT EXISTS "portion" varchar(8) NOT NULL DEFAULT 'full'`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'ck_aro_portion'
         ) THEN
           ALTER TABLE "accounts_receivable_orders"
             ADD CONSTRAINT "ck_aro_portion"
             CHECK ("portion" IN ('full', 'fixed', 'indexed'));
         END IF;
       END $$;`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_aro_order"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_aro_order_portion"
         ON "accounts_receivable_orders"("orderId", "portion")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_aro_order_portion"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_aro_order"
         ON "accounts_receivable_orders"("orderId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_orders" DROP CONSTRAINT IF EXISTS "ck_aro_portion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_orders" DROP COLUMN IF EXISTS "portion"`,
    );
  }
}
