import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mueve la relación Insurance de Patient a Contractor.
 *  - Crea pivot `contractor_insurances`.
 *  - Backfill: para cada paciente con seguros, replica esos seguros en cada
 *    contratista del paciente (mejor aproximación posible). De-dup vía
 *    ON CONFLICT.
 *  - Drop tabla `patient_insurances`.
 */
export class MoveInsuranceToContractor1782002400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contractor_insurances" (
        "contractorId" uuid NOT NULL REFERENCES "contractors"("id") ON DELETE CASCADE,
        "insuranceId" uuid NOT NULL REFERENCES "insurances"("id") ON DELETE CASCADE,
        PRIMARY KEY ("contractorId","insuranceId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ci_contractorId" ON "contractor_insurances"("contractorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ci_insuranceId" ON "contractor_insurances"("insuranceId")`,
    );

    // Backfill: cruza patient_insurances con patient_contractors.
    await queryRunner.query(`
      INSERT INTO "contractor_insurances"("contractorId","insuranceId")
      SELECT DISTINCT pc."contractorId", pi."insuranceId"
      FROM "patient_insurances" pi
      INNER JOIN "patient_contractors" pc ON pc."patientId" = pi."patientId"
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "patient_insurances"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "patient_insurances" (
        "patientId" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
        "insuranceId" uuid NOT NULL REFERENCES "insurances"("id") ON DELETE CASCADE,
        PRIMARY KEY ("patientId","insuranceId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_pi_patientId" ON "patient_insurances"("patientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pi_insuranceId" ON "patient_insurances"("insuranceId")`,
    );

    // Restore: cruza contractor_insurances con patient_contractors.
    await queryRunner.query(`
      INSERT INTO "patient_insurances"("patientId","insuranceId")
      SELECT DISTINCT pc."patientId", ci."insuranceId"
      FROM "contractor_insurances" ci
      INNER JOIN "patient_contractors" pc ON pc."contractorId" = ci."contractorId"
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "contractor_insurances"`);
  }
}
