import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restructura completa del módulo Retenciones por pagar.
 *
 * Cambios principales:
 *  - `taxes_payable` ya NO se crea en Paso 4 (facturación) y NO es 1↔1 con
 *    una `accounts_payable`. Ahora se crea atómicamente al registrar un pago
 *    de cuentas por pagar (AccountsPayableService.registerPayment), agrupando
 *    todas las órdenes/AP cubiertas en ese pago.
 *  - Una `taxes_payable` representa el comprobante de retención de ISLR de
 *    UN solo pago al proveedor.
 *  - Cálculo basado en Unidad Tributaria + Decreto 1.808:
 *      · Persona Jurídica Domiciliada (PJD): 5%, sin sustraendo, sin umbral.
 *      · Persona Natural Residente (PNR): 3% − sustraendo si gross > UT × 83,33334.
 *  - Centros de atención: tratados como PJD (5%).
 *
 * Wipe: la tabla anterior queda inservible y se descarta.
 */
export class RestructureTaxesPayable1782004300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Wipe estructura anterior
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable_payment_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable"`);

    // Crear tabla principal
    await queryRunner.query(`
      CREATE TABLE "taxes_payable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "taxPayableNumber" varchar(32) NOT NULL UNIQUE,
        "recipientType" varchar(16) NOT NULL,
        "doctorId" uuid NULL REFERENCES "doctors"("id") ON DELETE RESTRICT,
        "careCenterId" uuid NULL REFERENCES "care_centers"("id") ON DELETE RESTRICT,
        "personType" varchar(16) NOT NULL,
        "taxUnitId" uuid NOT NULL REFERENCES "tax_units"("id") ON DELETE RESTRICT,
        "taxUnitAmountBs" numeric(14,2) NOT NULL,
        "grossAmountBs" numeric(18,2) NOT NULL,
        "taxRate" numeric(5,4) NOT NULL,
        "subtrahendBs" numeric(14,2) NOT NULL DEFAULT 0,
        "taxAmountBs" numeric(18,2) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'unpaid',
        "paidAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "ck_tp_provider_xor" CHECK (
          ("recipientType" = 'doctor' AND "doctorId" IS NOT NULL AND "careCenterId" IS NULL)
          OR
          ("recipientType" = 'care_center' AND "careCenterId" IS NOT NULL AND "doctorId" IS NULL)
        ),
        CONSTRAINT "ck_tp_person_type" CHECK ("personType" IN ('natural', 'legal_entity')),
        CONSTRAINT "ck_tp_status" CHECK ("status" IN ('unpaid', 'partially_paid', 'paid'))
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_tp_status" ON "taxes_payable"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_tp_doctor" ON "taxes_payable"("doctorId")`);
    await queryRunner.query(`CREATE INDEX "idx_tp_careCenter" ON "taxes_payable"("careCenterId")`);
    await queryRunner.query(`CREATE INDEX "idx_tp_taxUnit" ON "taxes_payable"("taxUnitId")`);

    // Pivot tax_payable ↔ orders (factura agrupada lista órdenes)
    await queryRunner.query(`
      CREATE TABLE "taxes_payable_orders" (
        "taxPayableId" uuid NOT NULL REFERENCES "taxes_payable"("id") ON DELETE CASCADE,
        "orderId" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        PRIMARY KEY ("taxPayableId", "orderId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tp_orders_tax" ON "taxes_payable_orders"("taxPayableId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tp_orders_order" ON "taxes_payable_orders"("orderId")`,
    );

    // Pivot tax_payable ↔ accounts_payable (AP cubiertas por el pago que originó la retención)
    await queryRunner.query(`
      CREATE TABLE "taxes_payable_payables" (
        "taxPayableId" uuid NOT NULL REFERENCES "taxes_payable"("id") ON DELETE CASCADE,
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        PRIMARY KEY ("taxPayableId", "payableId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_tp_payables_tax" ON "taxes_payable_payables"("taxPayableId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tp_payables_payable" ON "taxes_payable_payables"("payableId")`,
    );

    // Pagos al SENIAT (mismo shape que accounts_payable_payments).
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

    // Pivot tax_payable ↔ pagos al SENIAT (N:N).
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

    // Secuencia (drop+recreate por idempotencia con sistemas que ya la tenían)
    await queryRunner.query(`DROP SEQUENCE IF EXISTS taxes_payable_seq`);
    await queryRunner.query(`
      CREATE SEQUENCE taxes_payable_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable_payment_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable_payables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes_payable"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS taxes_payable_seq`);
  }
}
