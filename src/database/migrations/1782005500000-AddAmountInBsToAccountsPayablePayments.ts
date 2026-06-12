import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pagos parciales a proveedor: para acumular en bolívares de forma exacta
 * (cada pago puede usar una tasa distinta), se persiste el monto en Bs de cada
 * pago al proveedor — espejo de `accounts_receivable_payments.amountInBs`.
 *
 * Históricos quedan en 0: las cuentas ya pagadas no se reprocesan, así que el
 * valor sólo importa para pagos nuevos (incluidos los parciales).
 */
export class AddAmountInBsToAccountsPayablePayments1782005500000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable_payments"
       ADD COLUMN IF NOT EXISTS "amountInBs" numeric(14,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable_payments" DROP COLUMN IF EXISTS "amountInBs"`,
    );
  }
}
