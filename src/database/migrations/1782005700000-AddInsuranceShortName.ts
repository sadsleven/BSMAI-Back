import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega "Nombre corto" (`shortName`) opcional a seguros. Texto libre ≤ 100
 * caracteres, nullable. No único (es una abreviatura para uso interno).
 */
export class AddInsuranceShortName1782005700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances" ADD COLUMN IF NOT EXISTS "shortName" varchar(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances" DROP COLUMN IF EXISTS "shortName"`,
    );
  }
}
