import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nombre corto / comercial del centro de atención ("URIMECA", "RISLAB").
 * Espeja `insurances."shortName"`: opcional y NO único. Se usa en listados y
 * reportes; los documentos legales siguen con la razón social completa.
 */
export class AddCareCenterShortName1782010900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "care_centers" ADD COLUMN IF NOT EXISTS "shortName" varchar(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "care_centers" DROP COLUMN IF EXISTS "shortName"`,
    );
  }
}
