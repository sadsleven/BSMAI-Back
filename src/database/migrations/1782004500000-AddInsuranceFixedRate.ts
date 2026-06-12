import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modo "tasa fija" para órdenes tipo seguro + columna Bs en pagos AR.
 *
 *  - `orders.useFixedRate boolean NOT NULL DEFAULT false` + `orders.fixedExchangeRateId uuid NULL`
 *    (FK exchange_rates RESTRICT). El seguro adeuda un monto fijo en Bs
 *    calculado al crear la orden con la tasa snapshot. Independiente del
 *    `billingExchangeRateId` (que es snapshot al facturar).
 *  - CHECK `chk_orders_fixed_rate_xor`: useFixedRate=true ↔ fixedExchangeRateId IS NOT NULL
 *    AND type='insurance'.
 *  - `accounts_receivable_payments.amountInBs numeric(18,2) NOT NULL DEFAULT 0`.
 *    Snapshot Bs por pago (cada pago tiene su propia tasa snapshot). Usado
 *    para comparar contra el target Bs de cuentas con tasa fija.
 *  - Backfill `amountInBs` para filas existentes vía conversión `amountValue × rate.amountBs`
 *    (best effort; 0 cuando falta tasa).
 */
export class AddInsuranceFixedRate1782004500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "useFixedRate" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fixedExchangeRateId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_fixed_exchange_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD CONSTRAINT "FK_orders_fixed_exchange_rate"
         FOREIGN KEY ("fixedExchangeRateId") REFERENCES "exchange_rates"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_fixed_rate_xor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_fixed_rate_xor" CHECK (
         ("useFixedRate" = true AND "fixedExchangeRateId" IS NOT NULL AND type = 'insurance')
         OR
         ("useFixedRate" = false AND "fixedExchangeRateId" IS NULL)
       )`,
    );

    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_payments"
         ADD COLUMN IF NOT EXISTS "amountInBs" numeric(18,2) NOT NULL DEFAULT 0`,
    );

    // Backfill amountInBs para pagos existentes. BS: amountValue. USD/EUR con rate: amountValue × rate.amountBs.
    await queryRunner.query(`
      UPDATE "accounts_receivable_payments" arp
      SET "amountInBs" = CASE
        WHEN arp."amountCurrency" = 'BS' THEN arp."amountValue"
        WHEN arp."exchangeRateId" IS NOT NULL THEN COALESCE(
          (SELECT (arp."amountValue" * er."amountBs")::numeric(18,2)
           FROM "exchange_rates" er WHERE er.id = arp."exchangeRateId"),
          0
        )
        ELSE 0
      END
      WHERE arp."amountInBs" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_payments" DROP COLUMN IF EXISTS "amountInBs"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_fixed_rate_xor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_fixed_exchange_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "fixedExchangeRateId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "useFixedRate"`,
    );
  }
}
