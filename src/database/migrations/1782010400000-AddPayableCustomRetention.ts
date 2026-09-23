import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retención SENIAT con monto manual por lote de Cuentas por pagar.
 *
 * `accounts_payable.customRetentionBs numeric(18,2) NULL`: si NO es NULL (y el
 * lote aplica retención) el monto retenido al proveedor es este valor fijo en
 * Bs, en lugar del cálculo automático (Decreto 1.808). NULL = automático
 * (comportamiento anterior; los lotes existentes no cambian).
 *
 * `taxes_payable.isCustomAmount boolean NOT NULL DEFAULT false`: snapshot en la
 * obligación SENIAT de que el monto fue fijado a mano (no se recalcula por
 * ajuste de UT del lote SENIAT).
 */
export class AddPayableCustomRetention1782010400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable"
         ADD COLUMN IF NOT EXISTS "customRetentionBs" numeric(18,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "taxes_payable"
         ADD COLUMN IF NOT EXISTS "isCustomAmount" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "taxes_payable" DROP COLUMN IF EXISTS "isCustomAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "customRetentionBs"`,
    );
  }
}
