import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pasos 2-4 del flujo de orden + módulos Cuentas por pagar / Cuentas por cobrar.
 *
 * Cambios en `orders`:
 *  - `attended boolean default false`
 *  - `attendedAt timestamptz null`
 *  - `otherStudies text null`
 *  - `doctorAmount numeric(14,2) null`
 *  - `doctorAmountCurrency varchar(3) null`  (USD | EUR | BS)
 *  - `billingExchangeRateId uuid null` (FK exchange_rates RESTRICT, capturada al pasar a facturación)
 *
 * Tablas nuevas:
 *  - `accounts_payable` + `accounts_payable_payments` + `accounts_payable_payment_links` (N:N).
 *  - `accounts_receivable` + `accounts_receivable_payments` + `accounts_receivable_payment_links` (N:N).
 *
 * Las cuentas se generan automáticamente al crear la orden (1 por orden + 1 receivable si type=insurance).
 */
export class OrderStagesAndAccounts1782002500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Extend orders ---
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "attended" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "attendedAt" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "otherStudies" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "doctorAmount" numeric(14,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "doctorAmountCurrency" varchar(3) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "billingExchangeRateId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_billingExchangeRate"
         FOREIGN KEY ("billingExchangeRateId") REFERENCES "exchange_rates"("id") ON DELETE RESTRICT`,
    );

    // --- accounts_payable ---
    await queryRunner.query(`
      CREATE TABLE "accounts_payable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "orderId" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
        "recipientType" varchar(16) NOT NULL,
        "doctorId" uuid NULL REFERENCES "doctors"("id") ON DELETE RESTRICT,
        "careCenterId" uuid NULL REFERENCES "care_centers"("id") ON DELETE RESTRICT,
        "status" varchar(16) NOT NULL DEFAULT 'unpaid',
        "paidAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_ap_status" ON "accounts_payable"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_ap_doctor" ON "accounts_payable"("doctorId")`);
    await queryRunner.query(
      `CREATE INDEX "idx_ap_careCenter" ON "accounts_payable"("careCenterId")`,
    );

    // --- accounts_payable_payments ---
    await queryRunner.query(`
      CREATE TABLE "accounts_payable_payments" (
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

    // --- pivot N:N pago ↔ cuenta payable ---
    await queryRunner.query(`
      CREATE TABLE "accounts_payable_payment_links" (
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "accounts_payable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("payableId", "paymentId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ap_links_payable" ON "accounts_payable_payment_links"("payableId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ap_links_payment" ON "accounts_payable_payment_links"("paymentId")`,
    );

    // --- accounts_receivable ---
    await queryRunner.query(`
      CREATE TABLE "accounts_receivable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "orderId" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
        "insuranceId" uuid NOT NULL REFERENCES "insurances"("id") ON DELETE RESTRICT,
        "status" varchar(16) NOT NULL DEFAULT 'uncollected',
        "collectedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_ar_status" ON "accounts_receivable"("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_ar_insurance" ON "accounts_receivable"("insuranceId")`,
    );

    // --- accounts_receivable_payments ---
    await queryRunner.query(`
      CREATE TABLE "accounts_receivable_payments" (
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
      CREATE TABLE "accounts_receivable_payment_links" (
        "receivableId" uuid NOT NULL REFERENCES "accounts_receivable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "accounts_receivable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("receivableId", "paymentId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ar_links_receivable" ON "accounts_receivable_payment_links"("receivableId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ar_links_payment" ON "accounts_receivable_payment_links"("paymentId")`,
    );

    // --- Backfill: generar cuentas para órdenes existentes ---
    await queryRunner.query(`
      INSERT INTO "accounts_payable" ("orderId", "recipientType", "doctorId", "careCenterId")
      SELECT o.id,
             o."providerType",
             o."doctorId",
             o."careCenterId"
      FROM "orders" o
      WHERE NOT EXISTS (SELECT 1 FROM "accounts_payable" ap WHERE ap."orderId" = o.id)
    `);
    await queryRunner.query(`
      INSERT INTO "accounts_receivable" ("orderId", "insuranceId")
      SELECT o.id, o."insuranceId"
      FROM "orders" o
      WHERE o."type" = 'insurance' AND o."insuranceId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "accounts_receivable" ar WHERE ar."orderId" = o.id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts_receivable_payment_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts_receivable_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts_receivable"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts_payable_payment_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts_payable_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts_payable"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_billingExchangeRate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "billingExchangeRateId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "doctorAmountCurrency"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "doctorAmount"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "otherStudies"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "attendedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "attended"`);
  }
}
