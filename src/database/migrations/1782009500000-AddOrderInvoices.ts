import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Facturas de la orden (Paso 4) como entidad propia, para poder ANULAR una
 * factura y emitir otra sin perder el rastro de la anulada.
 *
 *  - `order_invoices`: una fila por factura emitida. `status ∈ {active,
 *    cancelled}`; a lo sumo UNA activa por orden (`uq_order_invoices_active`).
 *  - `number bigint` = valor NUMÉRICO del N° de factura. UNIQUE **global**
 *    (índice parcial, sólo filas con número): los números NO se reutilizan
 *    jamás, tampoco los de las facturas anuladas — ese número ya se usó.
 *    `NULL` sólo en facturas históricas cuyo número no era numérico.
 *  - `invoiceNumber` / `controlNumber` = snapshots impresos. El control es
 *    DERIVADO (`number + 50`, con dos ceros delante): `04912` → `0004962`.
 *
 * `orders.invoiceNumber` / `controlNumber` / `invoiceDate` /
 * `invoiceExchangeRateId` se mantienen como ESPEJO de la factura vigente (los
 * consumen reportes, estado de cuenta de seguros y el comprobante ISLR). Al
 * anular la factura vigente el espejo queda en NULL hasta emitir otra.
 *
 * Backfill: cada orden ya facturada (`invoiceNumber` no nulo) estrena su
 * factura vigente. Si dos órdenes viejas repitieran el mismo número, sólo la
 * primera se queda con el `number` (las demás quedan en NULL) para no romper el
 * índice único; su `invoiceNumber` impreso se conserva igual.
 */
export class AddOrderInvoices1782009500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "order_invoices" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "orderId" uuid NOT NULL,
         "number" bigint NULL,
         "invoiceNumber" varchar(50) NOT NULL,
         "controlNumber" varchar(50) NOT NULL,
         "invoiceDate" date NOT NULL,
         "exchangeRateId" uuid NULL,
         "status" varchar(16) NOT NULL DEFAULT 'active',
         "cancelledAt" timestamptz NULL,
         "cancelReason" varchar(500) NULL,
         "cancelledById" uuid NULL,
         "createdById" uuid NULL,
         "createdAt" timestamptz NOT NULL DEFAULT now(),
         "updatedAt" timestamptz NOT NULL DEFAULT now(),
         CONSTRAINT "PK_order_invoices" PRIMARY KEY ("id"),
         CONSTRAINT "ck_order_invoices_status"
           CHECK ("status" IN ('active', 'cancelled')),
         CONSTRAINT "ck_order_invoices_cancel"
           CHECK (
             ("status" = 'cancelled' AND "cancelledAt" IS NOT NULL)
             OR ("status" = 'active' AND "cancelledAt" IS NULL)
           ),
         CONSTRAINT "FK_order_invoices_order"
           FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_order_invoices_rate"
           FOREIGN KEY ("exchangeRateId") REFERENCES "exchange_rates"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_order_invoices_cancelled_by"
           FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_order_invoices_created_by"
           FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
       )`,
    );

    // Backfill de las órdenes ya facturadas — sin `number` todavía.
    await queryRunner.query(
      `INSERT INTO "order_invoices"
         ("orderId", "invoiceNumber", "controlNumber", "invoiceDate",
          "exchangeRateId", "status", "createdAt", "updatedAt")
       SELECT o."id",
              o."invoiceNumber",
              COALESCE(o."controlNumber", ''),
              COALESCE(o."invoiceDate", o."orderDate"),
              o."invoiceExchangeRateId",
              'active',
              o."updatedAt",
              o."updatedAt"
         FROM "orders" o
        WHERE o."invoiceNumber" IS NOT NULL
          AND TRIM(o."invoiceNumber") <> ''
          AND NOT EXISTS (
            SELECT 1 FROM "order_invoices" i WHERE i."orderId" = o."id"
          )`,
    );

    // Valor numérico canónico: sólo la primera factura de cada número (las
    // repetidas de datos viejos quedan sin `number`, pero conservan el impreso).
    await queryRunner.query(
      `WITH ranked AS (
         SELECT i."id",
                (i."invoiceNumber")::bigint AS n,
                ROW_NUMBER() OVER (
                  PARTITION BY (i."invoiceNumber")::bigint
                  ORDER BY i."createdAt", i."id"
                ) AS rn
           FROM "order_invoices" i
          WHERE i."invoiceNumber" ~ '^[0-9]+$'
       )
       UPDATE "order_invoices" i
          SET "number" = r.n
         FROM ranked r
        WHERE r."id" = i."id" AND r.rn = 1`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_order_invoices_number"
         ON "order_invoices" ("number") WHERE "number" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_order_invoices_active"
         ON "order_invoices" ("orderId") WHERE "status" = 'active'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_order_invoices_order"
         ON "order_invoices" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_invoices_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_order_invoices_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_order_invoices_number"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_invoices"`);
  }
}
