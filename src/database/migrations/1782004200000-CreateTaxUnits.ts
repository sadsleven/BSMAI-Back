import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo Unidad Tributaria (UT). Valor histórico publicado por SENIAT vía
 * Gaceta Oficial. Se toma siempre la fila con la `effectiveDate` más reciente
 * <= hoy para calcular retenciones de ISLR (Decreto 1.808).
 *
 * Seed inicial: UT = Bs. 43,00 vigente desde 2025-06-02 (Gaceta 43.140,
 * Providencia SNAT/2025/000048).
 */
export class CreateTaxUnits1782004200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tax_units" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "amountBs" numeric(14,2) NOT NULL,
        "effectiveDate" date NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tax_units_effective_date" ON "tax_units"("effectiveDate" DESC) WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(`
      INSERT INTO "tax_units" ("amountBs", "effectiveDate", "isActive")
      VALUES ('43.00', '2025-06-02', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_units"`);
  }
}
