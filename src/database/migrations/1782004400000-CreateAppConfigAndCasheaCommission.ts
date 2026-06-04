import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Configuración global del sistema + snapshot de la comisión Cashea por orden.
 *
 *  - `app_config(key, value, updatedAt)` KV simple. Seed `cashea.commissionRate=0.10`.
 *  - `orders.casheaCommissionRate numeric(5,4) NULL`. Snapshot al crear la orden
 *    Cashea — preserva el % vigente en ese momento aunque el admin cambie el
 *    valor global luego.
 *  - CHECK `chk_orders_cashea_commission_xor`: rate seteado ↔ type='cashea'.
 *
 * Idempotente vía IF EXISTS / IF NOT EXISTS.
 */
export class CreateAppConfigAndCasheaCommission1782004400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_config" (
        "key" varchar(64) NOT NULL PRIMARY KEY,
        "value" text NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `INSERT INTO "app_config" ("key", "value") VALUES ($1, $2)
       ON CONFLICT ("key") DO NOTHING`,
      ['cashea.commissionRate', '0.10'],
    );

    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "casheaCommissionRate" numeric(5,4) NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_cashea_commission_xor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_cashea_commission_xor" CHECK (
         (type = 'cashea' AND "casheaCommissionRate" IS NOT NULL)
         OR
         (type <> 'cashea' AND "casheaCommissionRate" IS NULL)
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_cashea_commission_xor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "casheaCommissionRate"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "app_config"`);
  }
}
