import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pre-cambio EUR como método de pago: el tipo `cash_foreign` (efectivo en divisa
 * genérica) se divide en dos tipos explícitos:
 *  - `cash_usd` — efectivo en dólares
 *  - `cash_eur` — efectivo en euros
 *
 * Renombra filas existentes en las 5 tablas de pagos (order_payments,
 * accounts_payable_payments, accounts_receivable_payments,
 * credits_receivable_payments, tax_payable_payments) según `amountCurrency`.
 * Filas con amountCurrency='BS' (no debería existir bajo este tipo) quedan
 * como cash_eur por seguridad — pero la regla previa lo rechazaba, así que
 * la condición rara vez se cumple.
 *
 * Idempotente: si no hay filas con `cash_foreign`, no hace nada.
 */
export class SplitCashForeignPaymentType1782003900000
  implements MigrationInterface
{
  private readonly tables = [
    'order_payments',
    'accounts_payable_payments',
    'accounts_receivable_payments',
    'credits_receivable_payments',
    'taxes_payable_payments',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const t of this.tables) {
      await queryRunner.query(
        `UPDATE "${t}" SET "type" = 'cash_usd' WHERE "type" = 'cash_foreign' AND "amountCurrency" = 'USD'`,
      );
      await queryRunner.query(
        `UPDATE "${t}" SET "type" = 'cash_eur' WHERE "type" = 'cash_foreign' AND "amountCurrency" = 'EUR'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of this.tables) {
      await queryRunner.query(
        `UPDATE "${t}" SET "type" = 'cash_foreign' WHERE "type" IN ('cash_usd','cash_eur')`,
      );
    }
  }
}
