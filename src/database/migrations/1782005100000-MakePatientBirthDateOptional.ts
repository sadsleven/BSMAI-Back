import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `patients.birthDate` pasa a opcional (nullable). La cédula ya era opcional
 * (ver AddPatientPersonType).
 */
export class MakePatientBirthDateOptional1782005100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "birthDate" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversa best-effort: asume que no hay filas con birthDate NULL.
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "birthDate" SET NOT NULL`,
    );
  }
}
