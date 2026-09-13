import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo Retenciones por pagar (retención fiscal). Espejo de accounts_payable
 * filtrado a las cuentas que generan retención al pagar al proveedor.
 *
 * Reglas de tasa (consistentes con AccountsPayableService.taxRateFor):
 *  - Doctor natural   → 0.03  (env DOCTOR_NATURAL_TAX_RATE)
 *  - Doctor jurídico  → 0.05  (env DOCTOR_LEGAL_TAX_RATE)
 *  - Centro atención  → 0.05  (asumido jurídico; usa DOCTOR_LEGAL_TAX_RATE)
 *
 * Una taxes_payable existe 1↔1 con su accounts_payable (FK UNIQUE) y se crea
 * cuando la orden se factura (Paso 4) — momento en el cual queda fijo
 * providerAmount y por tanto el monto a retener.
 *
 * Numeración: secuencia taxes_payable_seq, bumpeable vía TAX_PAYABLE_NUMBER_START.
 */
export class TaxesPayable1782003400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "taxes_payable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "taxPayableNumber" varchar(32) NOT NULL UNIQUE,
        "accountsPayableId" uuid NOT NULL UNIQUE REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        "orderId" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "recipientType" varchar(16) NOT NULL,
        "doctorId" uuid NULL REFERENCES "doctors"("id") ON DELETE RESTRICT,
        "careCenterId" uuid NULL REFERENCES "care_centers"("id") ON DELETE RESTRICT,
        "taxAmount" numeric(14,2) NULL,
        "taxAmountCurrency" varchar(3) NULL,
        "taxRate" numeric(5,4) NULL,
        "status" varchar(16) NOT NULL DEFAULT 'unpaid',
        "paidAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tp_status" ON "taxes_payable"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tp_doctor" ON "taxes_payable"("doctorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tp_careCenter" ON "taxes_payable"("careCenterId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tp_order" ON "taxes_payable"("orderId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "taxes_payable_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "type" varchar(24) NOT NULL,
        "paymentDate" date NOT NULL,
        "referenceNumber" varchar(20) NULL,
        "bankCode" varchar(8) NULL,
        "accountNumber" varchar(40) NULL,
        "exchangeRateId" uuid NULL REFERENCES "exchange_rates"("id") ON DELETE RESTRICT,
        "amountCurrency" varchar(3) NOT NULL,
        "amountValue" numeric(14,2) NOT NULL,
        "amountInBs" numeric(18,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "taxes_payable_payment_links" (
        "taxPayableId" uuid NOT NULL REFERENCES "taxes_payable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "taxes_payable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("taxPayableId", "paymentId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tp_links_tax" ON "taxes_payable_payment_links"("taxPayableId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tp_links_payment" ON "taxes_payable_payment_links"("paymentId")`,
    );

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS taxes_payable_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    `);

    // Backfill: por cada AP con providerAmount NOT NULL, crear su taxes_payable.
    // taxRate doctor: 0.05 si isLegalEntity, sino 0.03. Care center: 0.05.
    await queryRunner.query(`
      INSERT INTO "taxes_payable" (
        "taxPayableNumber", "accountsPayableId", "orderId", "recipientType",
        "doctorId", "careCenterId", "taxAmount", "taxAmountCurrency", "taxRate"
      )
      SELECT
        CAST(nextval('taxes_payable_seq') AS varchar),
        ap.id,
        ap."orderId",
        ap."recipientType",
        ap."doctorId",
        ap."careCenterId",
        ROUND(
          ap."providerAmount" * (
            CASE
              WHEN ap."recipientType" = 'doctor' AND COALESCE(d."isLegalEntity", false) = true THEN 0.05
              WHEN ap."recipientType" = 'doctor' THEN 0.03
              WHEN ap."recipientType" = 'care_center' THEN 0.05
              ELSE 0
            END
          ),
          2
        ),
        ap."providerAmountCurrency",
        CASE
          WHEN ap."recipientType" = 'doctor' AND COALESCE(d."isLegalEntity", false) = true THEN 0.0500
          WHEN ap."recipientType" = 'doctor' THEN 0.0300
          WHEN ap."recipientType" = 'care_center' THEN 0.0500
          ELSE 0.0000
        END
      FROM "accounts_payable" ap
      LEFT JOIN "doctors" d ON d.id = ap."doctorId"
      WHERE ap."providerAmount" IS NOT NULL
        AND ap."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "taxes_payable" tp WHERE tp."accountsPayableId" = ap.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "taxes_payable_payment_links"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS taxes_payable_seq`);
  }
}
