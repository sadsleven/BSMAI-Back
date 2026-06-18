import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Habilita el tipo `card` (Punto / POS de tarjeta) en `payment_accounts`.
 * Recrea el CHECK XOR `CHK_pa_type_xor` agregando la combinación válida para
 * `card`: banco emisor (`bankCode`) + titular (`accountHolderName`); el resto
 * de columnas polimórficas en NULL. El número de referencia del pago con punto
 * se captura por transacción en `order_payments` / `accounts_receivable_payments`
 * (columnas `type` varchar sin CHECK → no requieren cambios).
 */
export class AddCardPaymentAccountType1782005800000 implements MigrationInterface {
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
    // Revierte al CHECK previo (sin `card`).
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
