import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInsuranceRif1782003500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances" ADD COLUMN IF NOT EXISTS "rif" varchar(20)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_insurances_rif_partial" ON "insurances"("rif") WHERE "rif" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_insurances_rif_partial"`);
    await queryRunner.query(`ALTER TABLE "insurances" DROP COLUMN IF EXISTS "rif"`);
  }
}
