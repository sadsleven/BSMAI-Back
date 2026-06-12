import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pre-cambio: elimina el EUR de los montos definidos. Los precios pasan a ser
 * sólo USD; el EUR se calculará luego como método de pago vía tasa de cambio.
 *  - Drop `particularPriceEur` en `service_types` y vuelve `particularPriceUsd`
 *    nullable (precio Particular ahora opcional).
 *  - Drop `priceEur` en `insurance_service_prices`, `doctor_service_prices`,
 *    `care_center_service_prices` y en el snapshot `order_service_pricing`.
 *
 * Idempotente vía `IF EXISTS` / `IF NOT EXISTS`.
 */
export class DropEurPricing1782003800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // service_types: USD opcional, sin EUR.
    await queryRunner.query(
      `ALTER TABLE "service_types" ALTER COLUMN "particularPriceUsd" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_types" ALTER COLUMN "particularPriceUsd" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_types" DROP COLUMN IF EXISTS "particularPriceEur"`,
    );

    // Sub-tablas de precios por actor: sin EUR.
    await queryRunner.query(
      `ALTER TABLE "insurance_service_prices" DROP COLUMN IF EXISTS "priceEur"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_service_prices" DROP COLUMN IF EXISTS "priceEur"`,
    );
    await queryRunner.query(
      `ALTER TABLE "care_center_service_prices" DROP COLUMN IF EXISTS "priceEur"`,
    );

    // Snapshot de precios de orden: sin EUR.
    await queryRunner.query(
      `ALTER TABLE "order_service_pricing" DROP COLUMN IF EXISTS "priceEur"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_pricing" ADD COLUMN IF NOT EXISTS "priceEur" numeric(14,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "care_center_service_prices" ADD COLUMN IF NOT EXISTS "priceEur" numeric(14,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_service_prices" ADD COLUMN IF NOT EXISTS "priceEur" numeric(14,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurance_service_prices" ADD COLUMN IF NOT EXISTS "priceEur" numeric(14,2) NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(
      `ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "particularPriceEur" numeric(14,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "service_types" SET "particularPriceUsd" = 0 WHERE "particularPriceUsd" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_types" ALTER COLUMN "particularPriceUsd" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_types" ALTER COLUMN "particularPriceUsd" SET NOT NULL`,
    );
  }
}
