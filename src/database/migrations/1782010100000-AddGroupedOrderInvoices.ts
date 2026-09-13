import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Factura AGRUPADA: una misma factura puede cubrir VARIAS órdenes del mismo
 * contratante (el paciente que se atendió varias veces en fechas distintas y
 * pide una sola factura).
 *
 *  - `order_invoice_orders` = pivot factura ↔ órdenes cubiertas.
 *    `order_invoices.orderId` se conserva como la orden EMISORA (dueña del
 *    CASCADE y del historial), pero TODAS las lecturas pasan por este pivot:
 *    así la orden agrupada (que no es la emisora) también ve la factura y no se
 *    le ofrece emitir otra.
 *  - `cancelled` es columna ESPEJO de `order_invoices.status` — la escriben
 *    emisión y anulación en la misma transacción. Existe porque un índice
 *    parcial no puede mirar otra tabla; mismo patrón que
 *    `order_internal_orders.cancelled`. Con ella, `uq_oio_order_active`
 *    garantiza que una orden esté a lo sumo en UNA factura vigente, y al
 *    anularla vuelve a quedar libre.
 *
 * Backfill: una fila por factura existente apuntando a su propia orden
 * (`cancelled` = la factura ya estaba anulada). No cambia nada de lo emitido.
 */
export class AddGroupedOrderInvoices1782010100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "order_invoice_orders" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "invoiceId" uuid NOT NULL,
         "orderId" uuid NOT NULL,
         "cancelled" boolean NOT NULL DEFAULT false,
         "createdAt" timestamptz NOT NULL DEFAULT now(),
         CONSTRAINT "PK_order_invoice_orders" PRIMARY KEY ("id"),
         CONSTRAINT "uq_oio_invoice_order" UNIQUE ("invoiceId", "orderId"),
         CONSTRAINT "FK_oio_invoice"
           FOREIGN KEY ("invoiceId") REFERENCES "order_invoices"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_oio_order"
           FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE
       )`,
    );

    await queryRunner.query(
      `INSERT INTO "order_invoice_orders" ("invoiceId", "orderId", "cancelled", "createdAt")
       SELECT i."id", i."orderId", (i."status" = 'cancelled'), i."createdAt"
         FROM "order_invoices" i
        WHERE NOT EXISTS (
          SELECT 1 FROM "order_invoice_orders" p
           WHERE p."invoiceId" = i."id" AND p."orderId" = i."orderId"
        )`,
    );

    // Una orden, a lo sumo una factura VIGENTE (las anuladas no cuentan).
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_oio_order_active"
         ON "order_invoice_orders" ("orderId") WHERE NOT "cancelled"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_oio_invoice"
         ON "order_invoice_orders" ("invoiceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_oio_order"
         ON "order_invoice_orders" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_oio_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_oio_invoice"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_oio_order_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_invoice_orders"`);
  }
}
