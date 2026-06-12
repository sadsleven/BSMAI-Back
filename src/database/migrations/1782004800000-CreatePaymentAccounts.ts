import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla `payment_accounts` — catálogo de cuentas propias del negocio
 * donde se recibe dinero. Estructura polimórfica por `type`:
 *  - mobile_payment: bankCode + phoneNumber + idDocument + accountHolderName
 *  - bank_transfer: bankCode + accountNumber + accountHolderName + idDocument
 *  - other:         description
 *
 * Validación XOR a nivel CHECK. Índice único parcial sobre `name` (mientras
 * no esté en papelera) para evitar duplicados de etiqueta humana.
 */
export class CreatePaymentAccounts1782004800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_accounts" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name"               varchar(200) NOT NULL,
        "type"               varchar(24) NOT NULL,
        "isActive"           boolean NOT NULL DEFAULT true,
        "bankCode"           varchar(8) NULL,
        "phoneNumber"        varchar(11) NULL,
        "idDocument"         varchar(24) NULL,
        "accountHolderName"  varchar(200) NULL,
        "accountNumber"      varchar(20) NULL,
        "description"        varchar(500) NULL,
        "createdAt"          timestamptz NOT NULL DEFAULT now(),
        "updatedAt"          timestamptz NOT NULL DEFAULT now(),
        "deletedAt"          timestamptz NULL
      )
    `);

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

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pa_type" ON "payment_accounts"("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pa_is_active" ON "payment_accounts"("isActive")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_pa_name_alive" ON "payment_accounts"("name") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_pa_name_alive"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pa_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pa_type"`);
    await queryRunner.query(
      `ALTER TABLE "payment_accounts" DROP CONSTRAINT IF EXISTS "CHK_pa_type_xor"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_accounts"`);
  }
}
