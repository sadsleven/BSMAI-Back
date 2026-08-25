import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajuste de monto del Paso 1 (descuento o recargo sobre el precio de catálogo).
 *
 * `priceBaseAmount` = suma de los precios de catálogo snapshot al guardar la
 * orden (baremo del seguro para órdenes de seguro; precio Particular para el
 * resto). El ajuste es derivado: `priceAmount − priceBaseAmount` — negativo es
 * descuento, positivo es recargo. Cuando hay ajuste se exige motivo y se guarda
 * quién lo aplicó y cuándo (trazabilidad; el historial de la orden también
 * registra el cambio).
 *
 * Backfill: las órdenes existentes quedan con base = monto ⇒ ajuste 0.
 */
export class AddOrderPriceAdjustment1782008700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "priceBaseAmount" numeric(14,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "priceAdjustmentNote" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "priceAdjustedById" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "priceAdjustedAt" timestamptz NULL`,
    );
    await queryRunner.query(
      `UPDATE "orders" SET "priceBaseAmount" = "priceAmount" WHERE "priceBaseAmount" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_price_adjusted_by"
       FOREIGN KEY ("priceAdjustedById") REFERENCES "users"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_orders_price_adjusted_by"
       ON "orders" ("priceAdjustedById")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_orders_price_adjusted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_price_adjusted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "priceAdjustedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "priceAdjustedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "priceAdjustmentNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "priceBaseAmount"`,
    );
  }
}
