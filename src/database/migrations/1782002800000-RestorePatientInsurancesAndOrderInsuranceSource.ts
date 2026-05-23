import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restaura `patient_insurances` (seguros directos del paciente, coexisten con
 * los derivados de contratistas) y agrega `orders.insuranceSource` para
 * registrar el origen del seguro al momento de crear la orden.
 *
 * - `patient_insurances`: pivot M2M Patient ↔ Insurance, idempotente
 *   (`CREATE TABLE IF NOT EXISTS`). FKs CASCADE.
 * - `orders.insuranceSource`: enum check (`direct` | `via_contractor`),
 *   nullable. Backfill:
 *     · type='insurance' + contractorId NOT NULL → 'via_contractor'
 *     · type='insurance' + contractorId NULL     → 'direct'
 *     · resto → NULL
 */
export class RestorePatientInsurancesAndOrderInsuranceSource1782002800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- patient_insurances ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_insurances" (
        "patientId" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
        "insuranceId" uuid NOT NULL REFERENCES "insurances"("id") ON DELETE CASCADE,
        PRIMARY KEY ("patientId","insuranceId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_insurances_patientId" ON "patient_insurances"("patientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_patient_insurances_insuranceId" ON "patient_insurances"("insuranceId")`,
    );

    // --- orders.insuranceSource ---
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "insuranceSource" varchar(16) NULL`,
    );
    // Backfill antes de instalar el CHECK constraint para que no falle por filas legacy.
    await queryRunner.query(`
      UPDATE "orders"
      SET "insuranceSource" = CASE
        WHEN "type" = 'insurance' AND "contractorId" IS NOT NULL THEN 'via_contractor'
        WHEN "type" = 'insurance' AND "contractorId" IS NULL THEN 'direct'
        ELSE NULL
      END
      WHERE "insuranceSource" IS NULL
    `);
    // CHECK: si existe valor, debe ser uno de los dos; null permitido (órdenes no-insurance).
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP CONSTRAINT IF EXISTS "CHK_orders_insuranceSource"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD CONSTRAINT "CHK_orders_insuranceSource"
      CHECK ("insuranceSource" IS NULL OR "insuranceSource" IN ('direct','via_contractor'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "CHK_orders_insuranceSource"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "insuranceSource"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_insurances"`);
  }
}
