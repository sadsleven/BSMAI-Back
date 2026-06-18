import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelo Pendientes + Lotes (paso 4/4) — Retenciones por pagar.
 *
 * `taxes_payable` queda como la OBLIGACIÓN (pendiente) de retención: se genera
 * automáticamente cuando un lote de Cuentas por pagar queda totalmente pagado
 * (1 retención por lote AP, ligada por `sourcePayableId`). Conserva los campos
 * del cálculo SENIAT.
 *
 * El pago al SENIAT pasa a un LOTE creado por el usuario (`tax_payment_batches`)
 * que agrupa N obligaciones del mismo proveedor (pivot
 * `tax_payment_batch_obligations`) y acumula M pagos
 * (`tax_payment_batch_payment_links` → `taxes_payable_payments`, reutilizada).
 *
 * No hay datos reales → DROP/recrea limpio, sin backfill.
 */
export class RestructureTaxesPayableBatches1782006500000
  implements MigrationInterface
{
  public async up(q: QueryRunner): Promise<void> {
    // Quitar el plumbing viejo (la retención ya no agrupa órdenes ni linkea pagos directo).
    await q.query(`DROP TABLE IF EXISTS "taxes_payable_payment_links"`);
    await q.query(`DROP TABLE IF EXISTS "taxes_payable_orders"`);
    await q.query(`DROP TABLE IF EXISTS "taxes_payable_payables"`);

    // LOTE de pago al SENIAT.
    await q.query(`
      CREATE TABLE "tax_payment_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "taxBatchNumber" varchar(32) NOT NULL UNIQUE,
        "recipientType" varchar(16) NOT NULL,
        "doctorId" uuid NULL REFERENCES "doctors"("id") ON DELETE RESTRICT,
        "careCenterId" uuid NULL REFERENCES "care_centers"("id") ON DELETE RESTRICT,
        "status" varchar(16) NOT NULL DEFAULT 'unpaid',
        "paidAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL,
        CONSTRAINT "ck_tpb_provider_xor" CHECK (
          ("recipientType" = 'doctor' AND "doctorId" IS NOT NULL AND "careCenterId" IS NULL)
          OR
          ("recipientType" = 'care_center' AND "careCenterId" IS NOT NULL AND "doctorId" IS NULL)
        ),
        CONSTRAINT "ck_tpb_status" CHECK ("status" IN ('unpaid', 'partially_paid', 'paid'))
      )
    `);
    await q.query(`CREATE INDEX "idx_tpb_status" ON "tax_payment_batches"("status")`);
    await q.query(`CREATE INDEX "idx_tpb_doctor" ON "tax_payment_batches"("doctorId")`);
    await q.query(`CREATE INDEX "idx_tpb_careCenter" ON "tax_payment_batches"("careCenterId")`);

    // taxes_payable: ligar a su lote AP de origen (1:1) y al lote SENIAT.
    await q.query(
      `ALTER TABLE "taxes_payable" ADD COLUMN IF NOT EXISTS "sourcePayableId" uuid NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE`,
    );
    await q.query(
      `CREATE UNIQUE INDEX "uq_tp_source_payable" ON "taxes_payable"("sourcePayableId") WHERE "sourcePayableId" IS NOT NULL`,
    );
    // La obligación pertenece a lo sumo a UN lote (naturalmente excluyente; el
    // monto objetivo es su propio `taxAmountBs`, inmutable → sin pivot ni snapshot).
    await q.query(
      `ALTER TABLE "taxes_payable" ADD COLUMN IF NOT EXISTS "taxPaymentBatchId" uuid NULL REFERENCES "tax_payment_batches"("id") ON DELETE SET NULL`,
    );
    await q.query(
      `CREATE INDEX "idx_tp_batch" ON "taxes_payable"("taxPaymentBatchId")`,
    );

    // Pivot N:N pago SENIAT ↔ lote (reutiliza taxes_payable_payments).
    await q.query(`
      CREATE TABLE "tax_payment_batch_payment_links" (
        "batchId" uuid NOT NULL REFERENCES "tax_payment_batches"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "taxes_payable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("batchId", "paymentId")
      )
    `);
    await q.query(
      `CREATE INDEX "idx_tpbpl_batch" ON "tax_payment_batch_payment_links"("batchId")`,
    );
    await q.query(
      `CREATE INDEX "idx_tpbpl_payment" ON "tax_payment_batch_payment_links"("paymentId")`,
    );

    // Secuencia del número de lote SENIAT.
    await q.query(`DROP SEQUENCE IF EXISTS tax_payment_batch_seq`);
    await q.query(`
      CREATE SEQUENCE tax_payment_batch_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP SEQUENCE IF EXISTS tax_payment_batch_seq`);
    await q.query(`DROP TABLE IF EXISTS "tax_payment_batch_payment_links"`);
    // Limpieza idempotente del pivot eliminado (puede existir de corridas previas).
    await q.query(`DROP TABLE IF EXISTS "tax_payment_batch_obligations"`);
    await q.query(`DROP INDEX IF EXISTS "idx_tp_batch"`);
    await q.query(`DROP INDEX IF EXISTS "uq_tp_source_payable"`);
    await q.query(`ALTER TABLE "taxes_payable" DROP COLUMN IF EXISTS "taxPaymentBatchId"`);
    await q.query(`ALTER TABLE "taxes_payable" DROP COLUMN IF EXISTS "sourcePayableId"`);
    await q.query(`DROP TABLE IF EXISTS "tax_payment_batches"`);

    // Recrear plumbing viejo de retenciones.
    await q.query(`
      CREATE TABLE IF NOT EXISTS "taxes_payable_orders" (
        "taxPayableId" uuid NOT NULL REFERENCES "taxes_payable"("id") ON DELETE CASCADE,
        "orderId" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        PRIMARY KEY ("taxPayableId", "orderId")
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "taxes_payable_payables" (
        "taxPayableId" uuid NOT NULL REFERENCES "taxes_payable"("id") ON DELETE CASCADE,
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        PRIMARY KEY ("taxPayableId", "payableId")
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS "taxes_payable_payment_links" (
        "taxPayableId" uuid NOT NULL REFERENCES "taxes_payable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "taxes_payable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("taxPayableId", "paymentId")
      )
    `);
  }
}
