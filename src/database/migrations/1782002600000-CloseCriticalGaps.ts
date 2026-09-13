import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cierra gaps críticos pendientes:
 *  - `insurances.policyNumber varchar(64) NULL` (sin unique).
 *  - Sequences `accounts_payable_seq`, `accounts_receivable_seq` para numeración human-readable.
 *  - `accounts_payable.payableNumber varchar(32) UNIQUE NOT NULL` con backfill desde sequence.
 *  - `accounts_receivable.receivableNumber varchar(32) UNIQUE NOT NULL` con backfill.
 */
export class CloseCriticalGaps1782002600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- Insurance.policyNumber ----
    await queryRunner.query(
      `ALTER TABLE "insurances" ADD COLUMN IF NOT EXISTS "policyNumber" varchar(64) NULL`,
    );

    // ---- Accounts Payable / Receivable numbers ----
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS accounts_payable_seq START 1`,
    );
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS accounts_receivable_seq START 1`,
    );

    // payableNumber
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "payableNumber" varchar(32) NULL`,
    );
    // backfill secuencialmente para órdenes existentes
    await queryRunner.query(`
      UPDATE "accounts_payable"
      SET "payableNumber" = nextval('accounts_payable_seq')::text
      WHERE "payableNumber" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ALTER COLUMN "payableNumber" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD CONSTRAINT "uq_accounts_payable_number" UNIQUE ("payableNumber")`,
    );

    // receivableNumber
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "receivableNumber" varchar(32) NULL`,
    );
    await queryRunner.query(`
      UPDATE "accounts_receivable"
      SET "receivableNumber" = nextval('accounts_receivable_seq')::text
      WHERE "receivableNumber" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ALTER COLUMN "receivableNumber" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD CONSTRAINT "uq_accounts_receivable_number" UNIQUE ("receivableNumber")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "uq_accounts_receivable_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP COLUMN IF EXISTS "receivableNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP CONSTRAINT IF EXISTS "uq_accounts_payable_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "payableNumber"`,
    );
    await queryRunner.query(`DROP SEQUENCE IF EXISTS accounts_payable_seq`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS accounts_receivable_seq`);
    await queryRunner.query(
      `ALTER TABLE "insurances" DROP COLUMN IF EXISTS "policyNumber"`,
    );
  }
}
