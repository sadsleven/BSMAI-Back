import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retención SENIAT opcional por lote de Cuentas por pagar.
 *
 * `accounts_payable.applyRetention boolean NOT NULL DEFAULT true`: si es
 * `false`, el lote NO descuenta la retención de ISLR (neto = bruto) y al
 * quedar pagado NO nace la obligación en `taxes_payable`. Por defecto `true`
 * (comportamiento anterior), así que los lotes existentes no cambian.
 */
export class AddPayableApplyRetention1782010000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable"
         ADD COLUMN IF NOT EXISTS "applyRetention" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "applyRetention"`,
    );
  }
}
