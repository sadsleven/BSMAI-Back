import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelo Pendientes + Lotes (paso 3/4) — Cuentas por cobrar.
 *
 * `accounts_receivable` deja de ser 1 fila auto-generada por orden y pasa a ser
 * un LOTE creado por el usuario para UN deudor (seguro o titular), que agrupa N
 * órdenes (pivot `accounts_receivable_orders`) y acumula M cobros.
 *
 * - Sin `orderId` (el target vive en la orden; se snapshotea en el pivot).
 * - El pivot guarda `useFixedRate` + `targetUsd`/`targetBs` al agregar la orden,
 *   para fijar el modo de cobro (Bs tasa fija vs USD) y el target del lote.
 * - Exclusividad: una orden está a lo sumo en UN lote (`uq_aro_order`).
 *
 * No hay datos reales → DROP/recrea limpio, sin backfill.
 */
export class RestructureAccountsReceivableBatches1782006400000
  implements MigrationInterface
{
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "accounts_receivable_payment_links"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_receivable_payments"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_receivable"`);

    // accounts_receivable = LOTE de cobro.
    await q.query(`
      CREATE TABLE "accounts_receivable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "receivableNumber" varchar(32) NOT NULL UNIQUE,
        "insuranceId" uuid NULL REFERENCES "insurances"("id") ON DELETE RESTRICT,
        "holderId" uuid NULL REFERENCES "patients"("id") ON DELETE RESTRICT,
        "status" varchar(16) NOT NULL DEFAULT 'uncollected',
        "collectedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "ck_ar_debtor_xor" CHECK (
          ("insuranceId" IS NOT NULL AND "holderId" IS NULL)
          OR
          ("holderId" IS NOT NULL AND "insuranceId" IS NULL)
        ),
        CONSTRAINT "ck_ar_status" CHECK (
          "status" IN ('uncollected', 'partially_collected', 'collected', 'overcollected')
        )
      )
    `);
    await q.query(`CREATE INDEX "idx_ar_status" ON "accounts_receivable"("status")`);
    await q.query(`CREATE INDEX "idx_ar_insurance" ON "accounts_receivable"("insuranceId")`);
    await q.query(`CREATE INDEX "idx_ar_holder" ON "accounts_receivable"("holderId")`);

    // Pivot lote ↔ orden (con snapshot de modo y target).
    await q.query(`
      CREATE TABLE "accounts_receivable_orders" (
        "receivableId" uuid NOT NULL REFERENCES "accounts_receivable"("id") ON DELETE CASCADE,
        "orderId" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "useFixedRate" boolean NOT NULL DEFAULT false,
        "targetUsd" numeric(14,2) NULL,
        "targetBs" numeric(18,2) NULL,
        PRIMARY KEY ("receivableId", "orderId")
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX "uq_aro_order" ON "accounts_receivable_orders"("orderId")`,
    );
    await q.query(
      `CREATE INDEX "idx_aro_receivable" ON "accounts_receivable_orders"("receivableId")`,
    );

    // Cobros + pivot N:N cobro ↔ lote (incluye paymentAccountId, amountInBs 18,2).
    await q.query(`
      CREATE TABLE "accounts_receivable_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "type" varchar(24) NOT NULL,
        "paymentDate" date NOT NULL,
        "referenceNumber" varchar(20) NULL,
        "bankCode" varchar(8) NULL,
        "accountNumber" varchar(40) NULL,
        "exchangeRateId" uuid NULL REFERENCES "exchange_rates"("id") ON DELETE RESTRICT,
        "paymentAccountId" uuid NULL REFERENCES "payment_accounts"("id") ON DELETE RESTRICT,
        "amountCurrency" varchar(3) NOT NULL,
        "amountValue" numeric(14,2) NOT NULL,
        "amountInUsd" numeric(14,2) NOT NULL DEFAULT 0,
        "amountInBs" numeric(18,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await q.query(`
      CREATE TABLE "accounts_receivable_payment_links" (
        "receivableId" uuid NOT NULL REFERENCES "accounts_receivable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "accounts_receivable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("receivableId", "paymentId")
      )
    `);
    await q.query(
      `CREATE INDEX "idx_ar_links_receivable" ON "accounts_receivable_payment_links"("receivableId")`,
    );
    await q.query(
      `CREATE INDEX "idx_ar_links_payment" ON "accounts_receivable_payment_links"("paymentId")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "accounts_receivable_payment_links"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_receivable_payments"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_receivable_orders"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_receivable"`);

    await q.query(`
      CREATE TABLE "accounts_receivable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "receivableNumber" varchar(32) NOT NULL UNIQUE,
        "orderId" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
        "insuranceId" uuid NULL REFERENCES "insurances"("id") ON DELETE RESTRICT,
        "holderId" uuid NULL REFERENCES "patients"("id") ON DELETE RESTRICT,
        "status" varchar(16) NOT NULL DEFAULT 'uncollected',
        "collectedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "ck_ar_debtor_xor" CHECK (
          ("insuranceId" IS NOT NULL AND "holderId" IS NULL)
          OR
          ("holderId" IS NOT NULL AND "insuranceId" IS NULL)
        )
      )
    `);
    await q.query(`CREATE INDEX "idx_ar_status" ON "accounts_receivable"("status")`);
    await q.query(`CREATE INDEX "idx_ar_insurance" ON "accounts_receivable"("insuranceId")`);
    await q.query(`CREATE INDEX "idx_ar_holder" ON "accounts_receivable"("holderId")`);

    await q.query(`
      CREATE TABLE "accounts_receivable_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "type" varchar(24) NOT NULL,
        "paymentDate" date NOT NULL,
        "referenceNumber" varchar(20) NULL,
        "bankCode" varchar(8) NULL,
        "accountNumber" varchar(40) NULL,
        "exchangeRateId" uuid NULL REFERENCES "exchange_rates"("id") ON DELETE RESTRICT,
        "paymentAccountId" uuid NULL REFERENCES "payment_accounts"("id") ON DELETE RESTRICT,
        "amountCurrency" varchar(3) NOT NULL,
        "amountValue" numeric(14,2) NOT NULL,
        "amountInUsd" numeric(14,2) NOT NULL DEFAULT 0,
        "amountInBs" numeric(18,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await q.query(`
      CREATE TABLE "accounts_receivable_payment_links" (
        "receivableId" uuid NOT NULL REFERENCES "accounts_receivable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "accounts_receivable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("receivableId", "paymentId")
      )
    `);
  }
}
