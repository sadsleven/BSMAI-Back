import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Comisión Cashea en dos tramos (reemplaza el % único `casheaCommissionRate`).
 *
 * Cashea retiene:
 *   - `firstInstallmentRate` (def 4%) sobre el monto de la PRIMERA CUOTA (inicial).
 *   - `totalRate` (def 6%) sobre el TOTAL de la orden.
 *
 * Comisión = primeraCuota × firstInstallmentRate + precio × totalRate.
 * Neto a cobrar = precio − comisión.
 *
 * Cambios:
 *  - `app_config`: nuevas keys `cashea.firstInstallmentRate=0.04` y
 *    `cashea.totalRate=0.06`. Se elimina la key vieja `cashea.commissionRate`.
 *  - `orders`: nuevas columnas snapshot
 *    `casheaFirstInstallmentAmount numeric(14,2)`,
 *    `casheaFirstInstallmentRate numeric(5,4)`,
 *    `casheaTotalRate numeric(5,4)`. Se elimina `casheaCommissionRate`.
 *  - Backfill de órdenes Cashea existentes: el % único viejo pasa a `totalRate`
 *    y la primera cuota queda en 0 (firstRate=0) → preserva el target histórico.
 *  - CHECK `chk_orders_cashea_fields`: los 3 campos seteados ↔ type='cashea'.
 *
 * Idempotente vía IF EXISTS / IF NOT EXISTS / ON CONFLICT.
 */
export class CasheaSplitCommission1782005400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- app_config: nuevas keys ---
    await queryRunner.query(
      `INSERT INTO "app_config" ("key", "value") VALUES ($1, $2), ($3, $4)
       ON CONFLICT ("key") DO NOTHING`,
      ['cashea.firstInstallmentRate', '0.04', 'cashea.totalRate', '0.06'],
    );

    // --- orders: nuevas columnas ---
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "casheaFirstInstallmentAmount" numeric(14,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "casheaFirstInstallmentRate" numeric(5,4) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "casheaTotalRate" numeric(5,4) NULL`,
    );

    // --- backfill: % único viejo → totalRate; primera cuota = 0 (firstRate=0) ---
    await queryRunner.query(
      `UPDATE "orders"
         SET "casheaFirstInstallmentAmount" = 0,
             "casheaFirstInstallmentRate" = 0,
             "casheaTotalRate" = COALESCE("casheaCommissionRate", 0)
       WHERE type = 'cashea'
         AND "casheaTotalRate" IS NULL`,
    );

    // --- reemplazar CHECK y columna vieja ---
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_cashea_commission_xor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "casheaCommissionRate"`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_cashea_fields"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_cashea_fields" CHECK (
         (type = 'cashea'
           AND "casheaFirstInstallmentAmount" IS NOT NULL
           AND "casheaFirstInstallmentRate" IS NOT NULL
           AND "casheaTotalRate" IS NOT NULL)
         OR
         (type <> 'cashea'
           AND "casheaFirstInstallmentAmount" IS NULL
           AND "casheaFirstInstallmentRate" IS NULL
           AND "casheaTotalRate" IS NULL)
       )`,
    );

    // --- limpiar key vieja ---
    await queryRunner.query(
      `DELETE FROM "app_config" WHERE "key" = 'cashea.commissionRate'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // --- restaurar columna vieja ---
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "casheaCommissionRate" numeric(5,4) NULL`,
    );
    await queryRunner.query(
      `UPDATE "orders"
         SET "casheaCommissionRate" = COALESCE("casheaTotalRate", 0)
       WHERE type = 'cashea'
         AND "casheaCommissionRate" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_cashea_fields"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "casheaFirstInstallmentAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "casheaFirstInstallmentRate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "casheaTotalRate"`,
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

    // --- app_config: restaurar key vieja, quitar nuevas ---
    await queryRunner.query(
      `INSERT INTO "app_config" ("key", "value") VALUES ('cashea.commissionRate', '0.10')
       ON CONFLICT ("key") DO NOTHING`,
    );
    await queryRunner.query(
      `DELETE FROM "app_config"
       WHERE "key" IN ('cashea.firstInstallmentRate', 'cashea.totalRate')`,
    );
  }
}
