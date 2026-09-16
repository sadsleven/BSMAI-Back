import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tasa de pago (USD/Bs) por lote de Cuentas por pagar.
 *
 * `accounts_payable.exchangeRateId uuid NULL` → `exchange_rates`. Define la
 * tasa a la que se convierte el bruto USD del lote a Bs (bruto Bs, retención
 * SENIAT y neto a pagar). Antes el neto se calculaba SIEMPRE con la tasa de
 * facturación de cada orden, así que cambiar la "tasa de pago" en la UI no
 * movía los bolívares a pagar.
 *
 * `NULL` = comportamiento anterior (tasa de facturación de cada orden), así
 * que los lotes existentes no cambian. Los lotes nuevos la fijan al crearse
 * (tasa vigente por defecto) y puede cambiarse mientras el lote no esté pagado.
 */
export class AddPayableExchangeRate1782010200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable"
         ADD COLUMN IF NOT EXISTS "exchangeRateId" uuid NULL
         REFERENCES "exchange_rates"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_exchangeRate" ON "accounts_payable"("exchangeRateId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ap_exchangeRate"`);
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "exchangeRateId"`,
    );
  }
}
