import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Retenciones por pagar — el LOTE SENIAT deja de pertenecer a UN proveedor.
 *
 * El pago de retenciones al SENIAT no es un pago a un doctor/centro: es la
 * obligación del agente de retención (la clínica) con el fisco. Por eso un lote
 * SENIAT puede agrupar retenciones de VARIOS proveedores (doctores/centros) y
 * pagarlas todas juntas. El proveedor sigue viviendo en cada obligación
 * (`taxes_payable.recipientType/doctorId/careCenterId`), no en el lote.
 *
 * Se quita el XOR de proveedor y las columnas de proveedor de
 * `tax_payment_batches`. (La restricción "un proveedor por lote" permanece sólo
 * en Cuentas por pagar, donde sí se paga a un proveedor concreto.)
 */
export class DropProviderFromTaxPaymentBatches1782006700000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "tax_payment_batches" DROP CONSTRAINT IF EXISTS "ck_tpb_provider_xor"`,
    );
    await q.query(`DROP INDEX IF EXISTS "idx_tpb_doctor"`);
    await q.query(`DROP INDEX IF EXISTS "idx_tpb_careCenter"`);
    await q.query(
      `ALTER TABLE "tax_payment_batches" DROP COLUMN IF EXISTS "recipientType"`,
    );
    await q.query(
      `ALTER TABLE "tax_payment_batches" DROP COLUMN IF EXISTS "doctorId"`,
    );
    await q.query(
      `ALTER TABLE "tax_payment_batches" DROP COLUMN IF EXISTS "careCenterId"`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    // Re-añade las columnas de proveedor (nullable) e índices. No se restaura el
    // XOR `ck_tpb_provider_xor`: los lotes creados bajo el modelo multi-proveedor
    // no tienen proveedor único y violarían la restricción.
    await q.query(
      `ALTER TABLE "tax_payment_batches" ADD COLUMN IF NOT EXISTS "recipientType" varchar(16) NULL`,
    );
    await q.query(
      `ALTER TABLE "tax_payment_batches" ADD COLUMN IF NOT EXISTS "doctorId" uuid NULL REFERENCES "doctors"("id") ON DELETE RESTRICT`,
    );
    await q.query(
      `ALTER TABLE "tax_payment_batches" ADD COLUMN IF NOT EXISTS "careCenterId" uuid NULL REFERENCES "care_centers"("id") ON DELETE RESTRICT`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_tpb_doctor" ON "tax_payment_batches"("doctorId")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_tpb_careCenter" ON "tax_payment_batches"("careCenterId")`,
    );
  }
}
