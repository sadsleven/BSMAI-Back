import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelo Pendientes + Lotes (paso 2/4) — Cuentas por pagar.
 *
 * `accounts_payable` deja de ser 1 fila auto-generada por proveedor/orden y pasa
 * a ser un LOTE creado por el usuario para UN proveedor (doctor o centro), que
 * agrupa N órdenes internas (pivot `accounts_payable_orders`) y acumula M pagos.
 *
 * - Sin `orderId` ni `providerAmount` (el monto vive en la orden interna).
 * - Exclusividad: una orden interna está a lo sumo en UN lote
 *   (`uq_apo_internal_order`); al anular el lote se borran físicamente las filas
 *   pivot y la orden vuelve a Pendientes.
 *
 * No hay datos reales → DROP/recrea limpio, sin backfill.
 */
export class RestructureAccountsPayableBatches1782006300000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Drop dependientes (FK a accounts_payable) y el modelo viejo.
    await q.query(`DROP TABLE IF EXISTS "taxes_payable_payables"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_payable_payment_links"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_payable_payments"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_payable"`);

    // accounts_payable = LOTE de pago.
    await q.query(`
      CREATE TABLE "accounts_payable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "payableNumber" varchar(32) NOT NULL UNIQUE,
        "recipientType" varchar(16) NOT NULL,
        "doctorId" uuid NULL REFERENCES "doctors"("id") ON DELETE RESTRICT,
        "careCenterId" uuid NULL REFERENCES "care_centers"("id") ON DELETE RESTRICT,
        "status" varchar(16) NOT NULL DEFAULT 'unpaid',
        "paidAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "ck_ap_provider_xor" CHECK (
          ("recipientType" = 'doctor' AND "doctorId" IS NOT NULL AND "careCenterId" IS NULL)
          OR
          ("recipientType" = 'care_center' AND "careCenterId" IS NOT NULL AND "doctorId" IS NULL)
        ),
        CONSTRAINT "ck_ap_status" CHECK ("status" IN ('unpaid', 'partially_paid', 'paid'))
      )
    `);
    await q.query(
      `CREATE INDEX "idx_ap_status" ON "accounts_payable"("status")`,
    );
    await q.query(
      `CREATE INDEX "idx_ap_doctor" ON "accounts_payable"("doctorId")`,
    );
    await q.query(
      `CREATE INDEX "idx_ap_careCenter" ON "accounts_payable"("careCenterId")`,
    );

    // Pivot lote ↔ orden interna (con snapshot del monto bruto USD).
    await q.query(`
      CREATE TABLE "accounts_payable_orders" (
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        "internalOrderId" uuid NOT NULL REFERENCES "order_internal_orders"("id") ON DELETE CASCADE,
        "grossUsd" numeric(14,2) NOT NULL,
        PRIMARY KEY ("payableId", "internalOrderId")
      )
    `);
    // Exclusividad: una orden interna a lo sumo en un lote activo (al anular se borra el pivot).
    await q.query(
      `CREATE UNIQUE INDEX "uq_apo_internal_order" ON "accounts_payable_orders"("internalOrderId")`,
    );
    await q.query(
      `CREATE INDEX "idx_apo_payable" ON "accounts_payable_orders"("payableId")`,
    );

    // Pagos al proveedor + pivot N:N pago ↔ lote.
    await q.query(`
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
        "amountInUsd" numeric(14,2) NOT NULL DEFAULT 0,
        "amountInBs" numeric(14,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await q.query(`
      CREATE TABLE "accounts_payable_payment_links" (
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "accounts_payable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("payableId", "paymentId")
      )
    `);
    await q.query(
      `CREATE INDEX "idx_ap_links_payable" ON "accounts_payable_payment_links"("payableId")`,
    );
    await q.query(
      `CREATE INDEX "idx_ap_links_payment" ON "accounts_payable_payment_links"("paymentId")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    // Reversa: lote → modelo viejo (1 AP por proveedor/orden con providerAmount).
    // Drop primero cualquier FK hacia accounts_payable (la recrea más abajo).
    await q.query(`DROP TABLE IF EXISTS "taxes_payable_payables"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_payable_payment_links"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_payable_payments"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_payable_orders"`);
    await q.query(`DROP TABLE IF EXISTS "accounts_payable"`);

    await q.query(`
      CREATE TABLE "accounts_payable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "payableNumber" varchar(32) NOT NULL UNIQUE,
        "orderId" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "recipientType" varchar(16) NOT NULL,
        "doctorId" uuid NULL REFERENCES "doctors"("id") ON DELETE RESTRICT,
        "careCenterId" uuid NULL REFERENCES "care_centers"("id") ON DELETE RESTRICT,
        "providerAmount" numeric(14,2) NULL,
        "status" varchar(16) NOT NULL DEFAULT 'unpaid',
        "paidAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await q.query(
      `CREATE INDEX "idx_ap_status" ON "accounts_payable"("status")`,
    );
    await q.query(
      `CREATE INDEX "idx_ap_doctor" ON "accounts_payable"("doctorId")`,
    );
    await q.query(
      `CREATE INDEX "idx_ap_careCenter" ON "accounts_payable"("careCenterId")`,
    );
    await q.query(`
      CREATE UNIQUE INDEX "UQ_ap_order_doctor" ON "accounts_payable" ("orderId", "doctorId")
      WHERE "doctorId" IS NOT NULL AND "deletedAt" IS NULL
    `);
    await q.query(`
      CREATE UNIQUE INDEX "UQ_ap_order_careCenter" ON "accounts_payable" ("orderId", "careCenterId")
      WHERE "careCenterId" IS NOT NULL AND "deletedAt" IS NULL
    `);

    await q.query(`
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
        "amountInUsd" numeric(14,2) NOT NULL DEFAULT 0,
        "amountInBs" numeric(14,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await q.query(`
      CREATE TABLE "accounts_payable_payment_links" (
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "accounts_payable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("payableId", "paymentId")
      )
    `);

    // Re-crea el pivot tax ↔ AP (lo recrea normalmente la migración de retenciones).
    await q.query(`
      CREATE TABLE IF NOT EXISTS "taxes_payable_payables" (
        "taxPayableId" uuid NOT NULL REFERENCES "taxes_payable"("id") ON DELETE CASCADE,
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        PRIMARY KEY ("taxPayableId", "payableId")
      )
    `);
  }
}
