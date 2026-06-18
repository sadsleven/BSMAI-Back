import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Habilita el tipo `bank_transfer_usd` (Transferencia en dólares) en
 * `payment_accounts`. Misma estructura que `bank_transfer` (banco del catálogo
 * VE + cuenta de 20 dígitos + titular + cédula/RIF), pero la cuenta opera en
 * USD: los cobros de este tipo se registran en USD sin tasa de cambio.
 *
 * Recrea el CHECK XOR `CHK_pa_type_xor` agregando la combinación válida para
 * `bank_transfer_usd`. Las columnas `type` de `order_payments` /
 * `accounts_receivable_payments` son varchar sin CHECK → no requieren cambios.
 */
export class AddBankTransferUsdPaymentAccountType1782006000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_accounts" DROP CONSTRAINT IF EXISTS "CHK_pa_type_xor"`,
    );
    await queryRunner.query(`
      ALTER TABLE "payment_accounts"
      ADD CONSTRAINT "CHK_pa_type_xor"
      CHECK (
        (
          "type" = 'mobile_payment'
          AND "bankCode" IS NOT NULL
          AND "phoneNumber" IS NOT NULL
          AND "idDocument" IS NOT NULL
          AND "accountHolderName" IS NOT NULL
          AND "accountNumber" IS NULL
          AND "description" IS NULL
        )
        OR (
          "type" = 'bank_transfer'
          AND "bankCode" IS NOT NULL
          AND "accountNumber" IS NOT NULL
          AND "accountHolderName" IS NOT NULL
          AND "idDocument" IS NOT NULL
          AND "phoneNumber" IS NULL
          AND "description" IS NULL
        )
        OR (
          "type" = 'bank_transfer_usd'
          AND "bankCode" IS NOT NULL
          AND "accountNumber" IS NOT NULL
          AND "accountHolderName" IS NOT NULL
          AND "idDocument" IS NOT NULL
          AND "phoneNumber" IS NULL
          AND "description" IS NULL
        )
        OR (
          "type" = 'card'
          AND "bankCode" IS NOT NULL
          AND "accountHolderName" IS NOT NULL
          AND "phoneNumber" IS NULL
          AND "idDocument" IS NULL
          AND "accountNumber" IS NULL
          AND "description" IS NULL
        )
        OR (
          "type" = 'other'
          AND "description" IS NOT NULL
          AND "bankCode" IS NULL
          AND "phoneNumber" IS NULL
          AND "idDocument" IS NULL
          AND "accountHolderName" IS NULL
          AND "accountNumber" IS NULL
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revierte al CHECK previo (sin `bank_transfer_usd`).
    await queryRunner.query(
      `ALTER TABLE "payment_accounts" DROP CONSTRAINT IF EXISTS "CHK_pa_type_xor"`,
    );
    await queryRunner.query(`
      ALTER TABLE "payment_accounts"
      ADD CONSTRAINT "CHK_pa_type_xor"
      CHECK (
        (
          "type" = 'mobile_payment'
          AND "bankCode" IS NOT NULL
          AND "phoneNumber" IS NOT NULL
          AND "idDocument" IS NOT NULL
          AND "accountHolderName" IS NOT NULL
          AND "accountNumber" IS NULL
          AND "description" IS NULL
        )
        OR (
          "type" = 'bank_transfer'
          AND "bankCode" IS NOT NULL
          AND "accountNumber" IS NOT NULL
          AND "accountHolderName" IS NOT NULL
          AND "idDocument" IS NOT NULL
          AND "phoneNumber" IS NULL
          AND "description" IS NULL
        )
        OR (
          "type" = 'card'
          AND "bankCode" IS NOT NULL
          AND "accountHolderName" IS NOT NULL
          AND "phoneNumber" IS NULL
          AND "idDocument" IS NULL
          AND "accountNumber" IS NULL
          AND "description" IS NULL
        )
        OR (
          "type" = 'other'
          AND "description" IS NOT NULL
          AND "bankCode" IS NULL
          AND "phoneNumber" IS NULL
          AND "idDocument" IS NULL
          AND "accountHolderName" IS NULL
          AND "accountNumber" IS NULL
        )
      )
    `);
  }
}
