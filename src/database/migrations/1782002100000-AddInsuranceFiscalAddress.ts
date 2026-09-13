import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInsuranceFiscalAddress1782002100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances" ADD COLUMN IF NOT EXISTS "fiscalAddress" varchar(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances" DROP COLUMN IF EXISTS "fiscalAddress"`,
    );
  }
}
