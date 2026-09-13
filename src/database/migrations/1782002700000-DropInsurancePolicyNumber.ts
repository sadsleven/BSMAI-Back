import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropInsurancePolicyNumber1782002700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances" DROP COLUMN IF EXISTS "policyNumber"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances" ADD COLUMN IF NOT EXISTS "policyNumber" varchar(64) NULL`,
    );
  }
}
