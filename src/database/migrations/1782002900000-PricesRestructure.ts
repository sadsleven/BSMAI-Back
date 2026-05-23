import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restructura el modelo de precios:
 *  - `service_types` recibe `particularPriceUsd/Eur` (NOT NULL, default 0).
 *  - Crea `insurance_service_prices`, `doctor_service_prices`,
 *    `care_center_service_prices` (UNIQUE por (owner, ST), priceUsd/Eur NOT NULL).
 *  - Crea `order_service_pricing` snapshot (orderId, serviceTypeId, kind).
 *  - Backfill desde `service_type_prices`: particular (insuranceId NULL) →
 *    columnas en service_types; insurance → `insurance_service_prices`.
 *  - Drop `service_type_prices`.
 *
 * Idempotente vía `IF NOT EXISTS` / `IF EXISTS`.
 */
export class PricesRestructure1782002900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1) Particular cols on service_types ---
    await queryRunner.query(
      `ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "particularPriceUsd" numeric(14,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "particularPriceEur" numeric(14,2) NOT NULL DEFAULT 0`,
    );

    // Backfill particular desde service_type_prices (la fila Particular tiene insuranceId NULL).
    // Si existen ambos (USD y EUR) los toma; si alguno es null en la fila vieja, queda en 0 (default).
    const hasOldPrices = (await queryRunner.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'service_type_prices'
       ) AS exists`,
    )) as Array<{ exists: boolean }>;
    const oldPricesExist = hasOldPrices[0]?.exists === true;

    if (oldPricesExist) {
      await queryRunner.query(`
        UPDATE "service_types" st SET
          "particularPriceUsd" = COALESCE(stp."priceUsd", 0),
          "particularPriceEur" = COALESCE(stp."priceEur", 0)
        FROM "service_type_prices" stp
        WHERE stp."serviceTypeId" = st."id" AND stp."insuranceId" IS NULL
      `);
    }

    // --- 2) insurance_service_prices ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "insurance_service_prices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "insuranceId" uuid NOT NULL REFERENCES "insurances"("id") ON DELETE CASCADE,
        "serviceTypeId" uuid NOT NULL REFERENCES "service_types"("id") ON DELETE RESTRICT,
        "priceUsd" numeric(14,2) NOT NULL,
        "priceEur" numeric(14,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_isp_insurance_st" ON "insurance_service_prices"("insuranceId","serviceTypeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_isp_insurance" ON "insurance_service_prices"("insuranceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_isp_serviceType" ON "insurance_service_prices"("serviceTypeId")`,
    );

    if (oldPricesExist) {
      // Backfill insurance prices. Filtra filas con ambos USD y EUR > 0 (NOT NULL en nueva tabla).
      // Si la fila vieja tenía null en alguna moneda, usa 0 — admin debería revisar.
      await queryRunner.query(`
        INSERT INTO "insurance_service_prices"("insuranceId","serviceTypeId","priceUsd","priceEur")
        SELECT
          stp."insuranceId",
          stp."serviceTypeId",
          COALESCE(stp."priceUsd", 0),
          COALESCE(stp."priceEur", 0)
        FROM "service_type_prices" stp
        WHERE stp."insuranceId" IS NOT NULL
        ON CONFLICT ("insuranceId","serviceTypeId") DO NOTHING
      `);
    }

    // --- 3) doctor_service_prices ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_service_prices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "doctorId" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
        "serviceTypeId" uuid NOT NULL REFERENCES "service_types"("id") ON DELETE RESTRICT,
        "priceUsd" numeric(14,2) NOT NULL,
        "priceEur" numeric(14,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_dsp_doctor_st" ON "doctor_service_prices"("doctorId","serviceTypeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dsp_doctor" ON "doctor_service_prices"("doctorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dsp_serviceType" ON "doctor_service_prices"("serviceTypeId")`,
    );

    // --- 4) care_center_service_prices ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "care_center_service_prices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "careCenterId" uuid NOT NULL REFERENCES "care_centers"("id") ON DELETE CASCADE,
        "serviceTypeId" uuid NOT NULL REFERENCES "service_types"("id") ON DELETE RESTRICT,
        "priceUsd" numeric(14,2) NOT NULL,
        "priceEur" numeric(14,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ccsp_carecenter_st" ON "care_center_service_prices"("careCenterId","serviceTypeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ccsp_carecenter" ON "care_center_service_prices"("careCenterId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ccsp_serviceType" ON "care_center_service_prices"("serviceTypeId")`,
    );

    // --- 5) order_service_pricing snapshot ---
    // kind discrimina origen: 'particular' o 'insurance' (cobro) | 'doctor' o 'care_center' (pago).
    // Cada (orderId, serviceTypeId, kind) único — permite snapshot de cobro + pago para mismo ST.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_service_pricing" (
        "orderId" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "serviceTypeId" uuid NOT NULL REFERENCES "service_types"("id") ON DELETE RESTRICT,
        "kind" varchar(16) NOT NULL,
        "priceUsd" numeric(14,2) NOT NULL,
        "priceEur" numeric(14,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("orderId","serviceTypeId","kind"),
        CONSTRAINT "CHK_osp_kind" CHECK ("kind" IN ('particular','insurance','doctor','care_center'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_osp_order" ON "order_service_pricing"("orderId")`,
    );

    // --- 6) doctorAmountSuggested on orders ---
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "doctorAmountSuggested" numeric(14,2) NULL`,
    );

    // --- 7) Drop service_type_prices ---
    await queryRunner.query(`DROP TABLE IF EXISTS "service_type_prices"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recrear service_type_prices vacío (esquema mínimo).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "service_type_prices" (
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
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "doctorAmountSuggested"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "order_service_pricing"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "care_center_service_prices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_service_prices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "insurance_service_prices"`);
    await queryRunner.query(
      `ALTER TABLE "service_types" DROP COLUMN IF EXISTS "particularPriceUsd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_types" DROP COLUMN IF EXISTS "particularPriceEur"`,
    );
  }
}
