import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `patients.address` pasa a opcional (nullable). Antes era NOT NULL.
 */
export class MakePatientAddressOptional1782006800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "address" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversa best-effort: asume que no hay filas con address NULL.
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "address" SET NOT NULL`,
    );
  }
}
