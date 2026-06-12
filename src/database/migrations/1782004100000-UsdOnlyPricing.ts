import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plataforma USD-only. Todos los precios/deudas/impuestos pasan a USD.
 * EUR y BS sobreviven sólo como métodos de pago (cash_eur, cash_bs,
 * mobile_payment, bank_transfer) que se convierten a USD vía tasa.
 *
 *  - orders: DROP priceCurrency, doctorAmountCurrency.
 *  - accounts_payable: DROP providerAmountCurrency.
 *  - taxes_payable: DROP taxAmountCurrency.
 *  - 4 tablas de pago (order_payments, accounts_payable_payments,
 *    accounts_receivable_payments, taxes_payable_payments):
 *    DROP amountInBs, ADD amountInUsd numeric(14,2) NOT NULL DEFAULT 0.
 *
 * `orders.billingExchangeRateId` se conserva — snapshot tasa USD/Bs al
 * facturar. En adelante apunta SIEMPRE a una ExchangeRate con currency='USD'.
 *
 * Idempotente vía IF EXISTS / IF NOT EXISTS.
 */
export class UsdOnlyPricing1782004100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Drop currency cols ---
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "priceCurrency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "doctorAmountCurrency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "providerAmountCurrency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "taxes_payable" DROP COLUMN IF EXISTS "taxAmountCurrency"`,
    );

    // --- Swap amountInBs → amountInUsd ---
    const paymentTables = [
      'order_payments',
      'accounts_payable_payments',
      'accounts_receivable_payments',
      'taxes_payable_payments',
    ];
    for (const t of paymentTables) {
      await queryRunner.query(
        `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "amountInBs"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "amountInUsd" numeric(14,2) NOT NULL DEFAULT 0`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const paymentTables = [
      'order_payments',
      'accounts_payable_payments',
      'accounts_receivable_payments',
      'taxes_payable_payments',
    ];
    for (const t of paymentTables) {
      await queryRunner.query(
        `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "amountInUsd"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "amountInBs" numeric(18,2) NOT NULL DEFAULT 0`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "taxes_payable" ADD COLUMN IF NOT EXISTS "taxAmountCurrency" varchar(3) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "providerAmountCurrency" varchar(3) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "doctorAmountCurrency" varchar(3) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "priceCurrency" varchar(3) NOT NULL DEFAULT 'USD'`,
    );
  }
}
