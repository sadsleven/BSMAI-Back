import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cashea v2 — la INICIAL no genera comisión propia; comisión + financiamiento.
 *
 * Modelo nuevo (reemplaza los dos tramos firstInstallmentRate/totalRate):
 *   - La INICIAL (`casheaFirstInstallmentAmount`) la cobra el comercio del titular
 *     en el Paso 1. Ya NO lleva comisión propia (se elimina el tramo sobre la
 *     primera cuota).
 *   - `commissionRate` (def 4.64%) se aplica sobre el TOTAL de la venta.
 *   - `financingRate` (def 6.2%) se aplica sobre el RESTANTE = total − inicial.
 *     Se muestra como "Financiamiento".
 *
 *   restante      = total − inicial
 *   comisión      = total × commissionRate
 *   financiamiento= restante × financingRate
 *   CxC (neto)    = restante − comisión − financiamiento
 *
 * Cambios:
 *  - `app_config`: nuevas keys `cashea.commissionRate=0.0464` y
 *    `cashea.financingRate=0.0620`. Se eliminan `cashea.firstInstallmentRate`
 *    y `cashea.totalRate`.
 *  - `orders`:
 *      · RENAME `casheaTotalRate` → `casheaCommissionRate` (misma base: el total).
 *      · ADD `casheaFinancingRate numeric(5,4)` (sobre el restante).
 *      · DROP `casheaFirstInstallmentRate` (el tramo de la inicial desaparece).
 *      · Backfill órdenes Cashea existentes: `casheaFinancingRate = 0`
 *        (históricamente no hubo financiamiento); `casheaCommissionRate`
 *        conserva el viejo `casheaTotalRate` (preserva el target histórico salvo
 *        el desaparecido tramo de la inicial).
 *  - CHECK `chk_orders_cashea_fields`: los 3 campos (inicial + ambas tasas)
 *    seteados ↔ type='cashea'.
 *
 * Idempotente vía IF EXISTS / IF NOT EXISTS / ON CONFLICT / bloques DO.
 */
export class CasheaInitialNoCommission1782007600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- app_config: nuevas keys, quitar viejas ---
    await queryRunner.query(
      `INSERT INTO "app_config" ("key", "value") VALUES ($1, $2), ($3, $4)
       ON CONFLICT ("key") DO NOTHING`,
      ['cashea.commissionRate', '0.0464', 'cashea.financingRate', '0.0620'],
    );
    await queryRunner.query(
      `DELETE FROM "app_config"
       WHERE "key" IN ('cashea.firstInstallmentRate', 'cashea.totalRate')`,
    );

    // --- orders: soltar el CHECK antes de tocar columnas ---
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_cashea_fields"`,
    );

    // --- rename casheaTotalRate → casheaCommissionRate (idempotente) ---
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'casheaTotalRate'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'casheaCommissionRate'
        ) THEN
          ALTER TABLE "orders" RENAME COLUMN "casheaTotalRate" TO "casheaCommissionRate";
        END IF;
      END $$;
    `);

    // --- add casheaFinancingRate, drop casheaFirstInstallmentRate ---
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "casheaFinancingRate" numeric(5,4) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders"
         DROP COLUMN IF EXISTS "casheaFirstInstallmentRate"`,
    );

    // --- backfill órdenes Cashea existentes: financiamiento = 0 ---
    await queryRunner.query(
      `UPDATE "orders"
         SET "casheaFinancingRate" = 0
       WHERE type = 'cashea' AND "casheaFinancingRate" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "orders"
         SET "casheaCommissionRate" = 0
       WHERE type = 'cashea' AND "casheaCommissionRate" IS NULL`,
    );

    // --- recrear CHECK con los campos nuevos ---
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_cashea_fields" CHECK (
         (type = 'cashea'
           AND "casheaFirstInstallmentAmount" IS NOT NULL
           AND "casheaCommissionRate" IS NOT NULL
           AND "casheaFinancingRate" IS NOT NULL)
         OR
         (type <> 'cashea'
           AND "casheaFirstInstallmentAmount" IS NULL
           AND "casheaCommissionRate" IS NULL
           AND "casheaFinancingRate" IS NULL)
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // --- soltar CHECK nuevo ---
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_cashea_fields"`,
    );

    // --- restaurar casheaFirstInstallmentRate ---
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "casheaFirstInstallmentRate" numeric(5,4) NULL`,
    );
    await queryRunner.query(
      `UPDATE "orders"
         SET "casheaFirstInstallmentRate" = 0
       WHERE type = 'cashea' AND "casheaFirstInstallmentRate" IS NULL`,
    );

    // --- rename casheaCommissionRate → casheaTotalRate (idempotente) ---
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'casheaCommissionRate'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'orders' AND column_name = 'casheaTotalRate'
        ) THEN
          ALTER TABLE "orders" RENAME COLUMN "casheaCommissionRate" TO "casheaTotalRate";
        END IF;
      END $$;
    `);

    // --- quitar casheaFinancingRate ---
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "casheaFinancingRate"`,
    );

    // --- recrear CHECK viejo (dos tramos) ---
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

    // --- app_config: restaurar keys viejas, quitar nuevas ---
    await queryRunner.query(
      `INSERT INTO "app_config" ("key", "value") VALUES ($1, $2), ($3, $4)
       ON CONFLICT ("key") DO NOTHING`,
      ['cashea.firstInstallmentRate', '0.04', 'cashea.totalRate', '0.06'],
    );
    await queryRunner.query(
      `DELETE FROM "app_config"
       WHERE "key" IN ('cashea.commissionRate', 'cashea.financingRate')`,
    );
  }
}
