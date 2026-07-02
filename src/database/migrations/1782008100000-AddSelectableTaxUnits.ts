import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UT seleccionable:
 * - `accounts_payable.taxUnitId`: UT elegida para el cálculo de la retención
 *   SENIAT del lote (NULL = usar la UT vigente, comportamiento anterior).
 * - `tax_payment_batches.adjustmentTaxUnitId`: ajuste de UT del lote SENIAT.
 *   Si la UT subió entre pagar la cuenta por pagar y enterar la retención,
 *   el monto a pagar al fisco se recalcula con esta UT (las obligaciones
 *   conservan su snapshot original).
 */
export class AddSelectableTaxUnits1782008100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "taxUnitId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable"
         ADD CONSTRAINT "fk_ap_tax_unit"
         FOREIGN KEY ("taxUnitId") REFERENCES "tax_units"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_taxUnit" ON "accounts_payable" ("taxUnitId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "tax_payment_batches" ADD COLUMN IF NOT EXISTS "adjustmentTaxUnitId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_payment_batches"
         ADD CONSTRAINT "fk_tpb_adjustment_tax_unit"
         FOREIGN KEY ("adjustmentTaxUnitId") REFERENCES "tax_units"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tpb_adjustmentTaxUnit" ON "tax_payment_batches" ("adjustmentTaxUnitId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_tpb_adjustmentTaxUnit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_payment_batches" DROP CONSTRAINT IF EXISTS "fk_tpb_adjustment_tax_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_payment_batches" DROP COLUMN IF EXISTS "adjustmentTaxUnitId"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ap_taxUnit"`);
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP CONSTRAINT IF EXISTS "fk_ap_tax_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "taxUnitId"`,
    );
  }
}
