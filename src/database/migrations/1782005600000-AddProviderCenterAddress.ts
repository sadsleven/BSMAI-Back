import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega "Dirección del centro" (`centerAddress`) opcional a doctores y centros
 * de atención. Texto libre ≤ 500 caracteres, nullable.
 */
export class AddProviderCenterAddress1782005600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "centerAddress" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "care_centers" ADD COLUMN IF NOT EXISTS "centerAddress" varchar(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "care_centers" DROP COLUMN IF EXISTS "centerAddress"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "centerAddress"`,
    );
  }
}
