import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega FK `paymentAccountId` (nullable, RESTRICT) a `order_payments` y
 * `accounts_receivable_payments`. Sólo se usa para pagos entrantes cuyo
 * `type` ∈ {mobile_payment, bank_transfer, other}. `cash_*` queda NULL.
 *
 * `accounts_payable_payments` (egresos) NO se toca: queda fuera del scope.
 *
 * Las columnas legacy `bankCode`/`accountNumber` se MANTIENEN para histórico
 * de pagos viejos. En pagos nuevos, BE snapshotea esos campos desde la
 * `PaymentAccount` al guardar (sólo aplica a mobile_payment y bank_transfer).
 */
export class AddPaymentAccountIdToPayments1782004900000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // order_payments
    await queryRunner.query(
      `ALTER TABLE "order_payments" ADD COLUMN IF NOT EXISTS "paymentAccountId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_payments" DROP CONSTRAINT IF EXISTS "FK_op_payment_account"`,
    );
    await queryRunner.query(`
      ALTER TABLE "order_payments"
      ADD CONSTRAINT "FK_op_payment_account"
      FOREIGN KEY ("paymentAccountId")
      REFERENCES "payment_accounts"("id")
      ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_op_payment_account" ON "order_payments"("paymentAccountId")`,
    );

    // accounts_receivable_payments
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_payments" ADD COLUMN IF NOT EXISTS "paymentAccountId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_payments" DROP CONSTRAINT IF EXISTS "FK_arp_payment_account"`,
    );
    await queryRunner.query(`
      ALTER TABLE "accounts_receivable_payments"
      ADD CONSTRAINT "FK_arp_payment_account"
      FOREIGN KEY ("paymentAccountId")
      REFERENCES "payment_accounts"("id")
      ON DELETE RESTRICT
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_arp_payment_account" ON "accounts_receivable_payments"("paymentAccountId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_arp_payment_account"`);
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_payments" DROP CONSTRAINT IF EXISTS "FK_arp_payment_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_payments" DROP COLUMN IF EXISTS "paymentAccountId"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_op_payment_account"`);
    await queryRunner.query(
      `ALTER TABLE "order_payments" DROP CONSTRAINT IF EXISTS "FK_op_payment_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_payments" DROP COLUMN IF EXISTS "paymentAccountId"`,
    );
  }
}
