import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paso 3 segmentado por proveedor: observaciones por doctor/centro. Archivos
 * por proveedor van por `kind` en la tabla `files`. XOR doctor/centro + unique
 * parcial por (orden, proveedor).
 */
export class CreateOrderProviderReports1782005300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_provider_reports" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "providerType" varchar(16) NOT NULL,
        "doctorId" uuid,
        "careCenterId" uuid,
        "observations" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_opr_order"
          FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_opr_doctor"
          FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_opr_care_center"
          FOREIGN KEY ("careCenterId") REFERENCES "care_centers"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_opr_provider_xor" CHECK (
          ("providerType" = 'doctor' AND "doctorId" IS NOT NULL AND "careCenterId" IS NULL)
          OR
          ("providerType" = 'care_center' AND "careCenterId" IS NOT NULL AND "doctorId" IS NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_opr_order" ON "order_provider_reports" ("orderId")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_opr_order_doctor"
      ON "order_provider_reports" ("orderId", "doctorId")
      WHERE "doctorId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_opr_order_care_center"
      ON "order_provider_reports" ("orderId", "careCenterId")
      WHERE "careCenterId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_opr_order_care_center"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_opr_order_doctor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_opr_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_provider_reports"`);
  }
}
