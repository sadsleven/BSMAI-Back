import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Limpieza de datos legacy del modelo anterior de retenciones.
 *
 * Tras `1782006500000` (Pendientes + Lotes), `taxes_payable` y
 * `taxes_payable_payments` conservan sus tablas (no se dropearon), así que en
 * servidores con datos del modelo viejo quedan:
 *  - Retenciones auto-generadas en el viejo `registerPayment` que ya NO tienen
 *    `sourcePayableId` (su lote AP de origen no existe en el modelo nuevo) ni
 *    `taxPaymentBatchId` → huérfanas.
 *  - Pagos SENIAT cuyo pivot de enlace (`taxes_payable_payment_links`) fue
 *    dropeado → sin ningún `tax_payment_batch_payment_links` que los referencie.
 *
 * Las purga para no tener que borrarlas a mano en el server. Predicados
 * acotados a filas legacy: una retención nueva SIEMPRE nace con `sourcePayableId`
 * (al pagarse un lote AP) y un pago SENIAT nuevo SIEMPRE queda ligado a un lote.
 * Idempotente: en una BD limpia borra 0 filas.
 *
 * `accounts_payable`/`accounts_receivable` + sus pagos se recrean vacíos en
 * `1782006300000`/`1782006400000`, así que no requieren limpieza aquí.
 *
 * Irreversible por naturaleza (borra datos) → `down` es no-op.
 */
export class PurgeLegacyTaxesPayable1782006600000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Pagos SENIAT viejos sin enlace a ningún lote.
    await q.query(
      `DELETE FROM "taxes_payable_payments" p
       WHERE NOT EXISTS (
         SELECT 1 FROM "tax_payment_batch_payment_links" l WHERE l."paymentId" = p.id
       )`,
    );
    // Retenciones huérfanas (sin lote AP de origen ni lote SENIAT).
    await q.query(
      `DELETE FROM "taxes_payable"
       WHERE "sourcePayableId" IS NULL AND "taxPaymentBatchId" IS NULL`,
    );
  }

  public async down(): Promise<void> {
    // No-op: los datos legacy purgados no se pueden restaurar.
  }
}
