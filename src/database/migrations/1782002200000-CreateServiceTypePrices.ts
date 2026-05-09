import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Precios por tipo de servicio. Cada fila representa el precio de un service_type
 * para un seguro particular (insuranceId NOT NULL) o el precio "Particular" sin
 * seguro (insuranceId IS NULL). Cada fila puede tener priceUsd, priceEur o ambos
 * (cualquiera nullable). Unique parcial garantiza una fila por (ST, insurance) y
 * una sola fila Particular por ST.
 */
export class CreateServiceTypePrices1782002200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "service_type_prices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "serviceTypeId" uuid NOT NULL REFERENCES "service_types"("id") ON DELETE CASCADE,
        "insuranceId" uuid NULL REFERENCES "insurances"("id") ON DELETE CASCADE,
        "priceUsd" numeric(14,2) NULL,
        "priceEur" numeric(14,2) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_stp_serviceType_insurance" ON "service_type_prices"("serviceTypeId","insuranceId") WHERE "insuranceId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_stp_serviceType_particular" ON "service_type_prices"("serviceTypeId") WHERE "insuranceId" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stp_serviceTypeId" ON "service_type_prices"("serviceTypeId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "service_type_prices"`);
  }
}
