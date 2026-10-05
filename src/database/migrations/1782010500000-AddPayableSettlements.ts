import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ABONOS de Cuentas por pagar: retención por pago en vez de una por lote.
 *
 * Antes el lote tenía UNA tasa y UNA retención, y los pagos sólo acumulaban Bs
 * contra el neto resultante. Pagar un lote en dos partes a tasas distintas
 * recalculaba el bruto de TODO el lote (incluida la parte ya pagada a la tasa
 * vieja) y el cuadre del segundo pago pedía un monto que no era el transferido.
 *
 * Ahora el saldo del lote se lleva en USD y cada abono
 * (`accounts_payable_settlements`) cubre una porción del bruto USD con SU tasa
 * y SU retención, snapshoteadas. Las filas de pago cuelgan del abono
 * (`accounts_payable_payments.settlementId`, reemplaza a la N:N
 * `accounts_payable_payment_links`) y cada abono genera su propia obligación
 * SENIAT (`taxes_payable.sourceSettlementId`), con la fecha del abono.
 *
 * Backfill: cada lote con pagos se convierte en UN abono con la tasa y la
 * retención que el lote tenía (comportamiento idéntico al anterior). En lotes
 * parcialmente pagados el abono cubre la proporción pagada y su retención es la
 * parte proporcional (aún no había obligación SENIAT que conciliar). La
 * obligación existente del lote se reatacha a ese abono.
 */
export class AddPayableSettlements1782010500000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "accounts_payable_settlements" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        "settlementDate" date NOT NULL,
        "coveredUsd" numeric(14,2) NOT NULL,
        "exchangeRateId" uuid NOT NULL REFERENCES "exchange_rates"("id") ON DELETE RESTRICT,
        "rateBs" numeric(14,2) NOT NULL,
        "grossBs" numeric(18,2) NOT NULL,
        "personType" varchar(16) NOT NULL,
        "taxUnitId" uuid NULL REFERENCES "tax_units"("id") ON DELETE RESTRICT,
        "taxUnitAmountBs" numeric(14,2) NOT NULL DEFAULT 0,
        "taxRate" numeric(5,4) NOT NULL DEFAULT 0,
        "subtrahendBs" numeric(14,2) NOT NULL DEFAULT 0,
        "retentionBs" numeric(18,2) NOT NULL DEFAULT 0,
        "isCustomRetention" boolean NOT NULL DEFAULT false,
        "netBs" numeric(18,2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_aps_payable" ON "accounts_payable_settlements"("payableId")`,
    );

    await q.query(
      `ALTER TABLE "accounts_payable_payments"
         ADD COLUMN IF NOT EXISTS "settlementId" uuid NULL`,
    );
    await q.query(
      `ALTER TABLE "taxes_payable"
         ADD COLUMN IF NOT EXISTS "sourceSettlementId" uuid NULL`,
    );

    // --- Backfill: 1 abono por lote con pagos -------------------------------
    // `apo` → bruto USD del lote; `pay` → Bs ya entregados al proveedor; la
    // tasa es la de pago del lote o, en lotes previos, la de facturación de su
    // primera orden. `share` = proporción del neto que se alcanzó a pagar.
    await q.query(`
      WITH rate AS (
        SELECT ap.id AS "payableId",
               COALESCE(
                 (SELECT er."amountBs" FROM "exchange_rates" er WHERE er.id = ap."exchangeRateId"),
                 (SELECT er2."amountBs"
                    FROM "accounts_payable_orders" apo
                    JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
                    JOIN "orders" o ON o.id = iio."orderId"
                    JOIN "exchange_rates" er2 ON er2.id = o."billingExchangeRateId"
                   WHERE apo."payableId" = ap.id
                   ORDER BY er2."effectiveDate" DESC
                   LIMIT 1)
               ) AS "rateBs",
               COALESCE(
                 ap."exchangeRateId",
                 (SELECT er3.id
                    FROM "accounts_payable_orders" apo2
                    JOIN "order_internal_orders" iio2 ON iio2.id = apo2."internalOrderId"
                    JOIN "orders" o2 ON o2.id = iio2."orderId"
                    JOIN "exchange_rates" er3 ON er3.id = o2."billingExchangeRateId"
                   WHERE apo2."payableId" = ap.id
                   ORDER BY er3."effectiveDate" DESC
                   LIMIT 1)
               ) AS "exchangeRateId"
          FROM "accounts_payable" ap
      ), base AS (
        SELECT ap.id AS "payableId",
               ap."applyRetention",
               ap."customRetentionBs",
               ap."taxUnitId",
               CASE WHEN ap."recipientType" = 'care_center' THEN 'legal_entity'
                    WHEN COALESCE(d."isLegalEntity", false) THEN 'legal_entity'
                    ELSE 'natural' END AS "personType",
               r."rateBs",
               r."exchangeRateId",
               COALESCE(ut."amountBs", (SELECT u2."amountBs" FROM "tax_units" u2
                                         WHERE u2."isActive" = true
                                         ORDER BY u2."effectiveDate" DESC LIMIT 1), 0) AS "utBs",
               (SELECT COALESCE(SUM(apo."grossUsd"), 0)
                  FROM "accounts_payable_orders" apo WHERE apo."payableId" = ap.id) AS "grossUsd",
               (SELECT COALESCE(SUM(p."amountInBs"), 0)
                  FROM "accounts_payable_payment_links" l
                  JOIN "accounts_payable_payments" p ON p.id = l."paymentId" AND p."deletedAt" IS NULL
                 WHERE l."payableId" = ap.id) AS "paidBs",
               (SELECT MAX(p."paymentDate")
                  FROM "accounts_payable_payment_links" l
                  JOIN "accounts_payable_payments" p ON p.id = l."paymentId" AND p."deletedAt" IS NULL
                 WHERE l."payableId" = ap.id) AS "lastPaymentDate"
          FROM "accounts_payable" ap
          LEFT JOIN "doctors" d ON d.id = ap."doctorId"
          LEFT JOIN "tax_units" ut ON ut.id = ap."taxUnitId"
          JOIN rate r ON r."payableId" = ap.id
         WHERE ap."deletedAt" IS NULL
      ), calc AS (
        SELECT b.*,
               ROUND(b."grossUsd" * COALESCE(b."rateBs", 0), 2) AS "grossBs",
               CASE WHEN b."personType" = 'legal_entity' THEN 0.0500 ELSE 0.0300 END AS "taxRate",
               CASE WHEN b."personType" = 'legal_entity' THEN 0
                    ELSE ROUND(b."utBs" * 0.03 * 83.33334, 2) END AS "fullSubtrahendBs"
          FROM base b
      ), full_ret AS (
        SELECT c.*,
               CASE
                 WHEN NOT c."applyRetention" THEN 0
                 WHEN c."customRetentionBs" IS NOT NULL THEN c."customRetentionBs"
                 WHEN c."personType" = 'legal_entity' THEN ROUND(c."grossBs" * 0.05, 2)
                 WHEN c."grossBs" <= ROUND(c."utBs" * 83.33334, 2) THEN 0
                 ELSE GREATEST(0, ROUND(c."grossBs" * 0.03 - c."fullSubtrahendBs", 2))
               END AS "fullRetentionBs"
          FROM calc c
      ), shared AS (
        SELECT f.*,
               CASE WHEN f."grossBs" - f."fullRetentionBs" > 0
                    THEN LEAST(1, f."paidBs" / (f."grossBs" - f."fullRetentionBs"))
                    ELSE 0 END AS share
          FROM full_ret f
      )
      INSERT INTO "accounts_payable_settlements" (
        "payableId", "settlementDate", "coveredUsd", "exchangeRateId", "rateBs",
        "grossBs", "personType", "taxUnitId", "taxUnitAmountBs", "taxRate",
        "subtrahendBs", "retentionBs", "isCustomRetention", "netBs")
      SELECT s."payableId",
             COALESCE(s."lastPaymentDate", CURRENT_DATE),
             ROUND(s."grossUsd" * s.share, 2),
             s."exchangeRateId",
             s."rateBs",
             ROUND(s."grossBs" * s.share, 2),
             s."personType",
             CASE WHEN s."applyRetention" THEN s."taxUnitId" ELSE NULL END,
             s."utBs",
             CASE WHEN s."applyRetention" THEN s."taxRate" ELSE 0 END,
             CASE WHEN s."applyRetention" THEN ROUND(s."fullSubtrahendBs" * s.share, 2) ELSE 0 END,
             ROUND(s."fullRetentionBs" * s.share, 2),
             s."customRetentionBs" IS NOT NULL AND s."applyRetention",
             ROUND(s."grossBs" * s.share, 2) - ROUND(s."fullRetentionBs" * s.share, 2)
        FROM shared s
       WHERE s."paidBs" > 0 AND s."rateBs" IS NOT NULL AND s."exchangeRateId" IS NOT NULL
    `);

    // Filas de pago → su abono; obligación SENIAT existente → ese mismo abono.
    await q.query(`
      UPDATE "accounts_payable_payments" p
         SET "settlementId" = s.id
        FROM "accounts_payable_payment_links" l
        JOIN "accounts_payable_settlements" s ON s."payableId" = l."payableId"
       WHERE l."paymentId" = p.id AND p."settlementId" IS NULL`);
    await q.query(`
      UPDATE "taxes_payable" tp
         SET "sourceSettlementId" = s.id
        FROM "accounts_payable_settlements" s
       WHERE s."payableId" = tp."sourcePayableId" AND tp."sourceSettlementId" IS NULL`);

    // Pagos huérfanos (sin link a ningún lote): no hay abono al que colgarlos.
    await q.query(
      `DELETE FROM "accounts_payable_payments" WHERE "settlementId" IS NULL`,
    );
    await q.query(
      `ALTER TABLE "accounts_payable_payments"
         ALTER COLUMN "settlementId" SET NOT NULL`,
    );
    await q.query(
      `ALTER TABLE "accounts_payable_payments"
         ADD CONSTRAINT "fk_app_settlement"
         FOREIGN KEY ("settlementId") REFERENCES "accounts_payable_settlements"("id")
         ON DELETE CASCADE`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_app_settlement" ON "accounts_payable_payments"("settlementId")`,
    );
    await q.query(
      `ALTER TABLE "taxes_payable"
         ADD CONSTRAINT "fk_tp_source_settlement"
         FOREIGN KEY ("sourceSettlementId") REFERENCES "accounts_payable_settlements"("id")
         ON DELETE CASCADE`,
    );
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_tp_source_settlement"
         ON "taxes_payable"("sourceSettlementId") WHERE "sourceSettlementId" IS NOT NULL`,
    );
    // La unicidad pasa del lote al abono: un lote pagado en N abonos genera N
    // obligaciones (una por período fiscal), así que el lote deja de ser único.
    await q.query(`DROP INDEX IF EXISTS "uq_tp_source_payable"`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_tp_source_payable"
         ON "taxes_payable"("sourcePayableId")`,
    );

    await q.query(`DROP TABLE IF EXISTS "accounts_payable_payment_links"`);
    await q.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "customRetentionBs"`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "accounts_payable"
         ADD COLUMN IF NOT EXISTS "customRetentionBs" numeric(18,2) NULL`,
    );
    await q.query(`
      CREATE TABLE IF NOT EXISTS "accounts_payable_payment_links" (
        "payableId" uuid NOT NULL REFERENCES "accounts_payable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "accounts_payable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("payableId", "paymentId")
      )`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_links_payable" ON "accounts_payable_payment_links"("payableId")`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_links_payment" ON "accounts_payable_payment_links"("paymentId")`,
    );
    await q.query(`
      INSERT INTO "accounts_payable_payment_links" ("payableId", "paymentId")
      SELECT s."payableId", p.id
        FROM "accounts_payable_payments" p
        JOIN "accounts_payable_settlements" s ON s.id = p."settlementId"
      ON CONFLICT DO NOTHING`);
    // La retención manual del lote se reconstruye desde sus abonos manuales.
    await q.query(`
      UPDATE "accounts_payable" ap
         SET "customRetentionBs" = agg."retentionBs"
        FROM (SELECT "payableId", SUM("retentionBs") AS "retentionBs"
                FROM "accounts_payable_settlements"
               WHERE "isCustomRetention" AND "deletedAt" IS NULL
               GROUP BY "payableId") agg
       WHERE agg."payableId" = ap.id`);
    await q.query(`DROP INDEX IF EXISTS "idx_tp_source_payable"`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_tp_source_payable"
         ON "taxes_payable"("sourcePayableId") WHERE "sourcePayableId" IS NOT NULL`,
    );
    await q.query(
      `ALTER TABLE "taxes_payable" DROP CONSTRAINT IF EXISTS "fk_tp_source_settlement"`,
    );
    await q.query(`DROP INDEX IF EXISTS "uq_tp_source_settlement"`);
    await q.query(
      `ALTER TABLE "taxes_payable" DROP COLUMN IF EXISTS "sourceSettlementId"`,
    );
    await q.query(
      `ALTER TABLE "accounts_payable_payments" DROP CONSTRAINT IF EXISTS "fk_app_settlement"`,
    );
    await q.query(`DROP INDEX IF EXISTS "idx_app_settlement"`);
    await q.query(
      `ALTER TABLE "accounts_payable_payments" DROP COLUMN IF EXISTS "settlementId"`,
    );
    await q.query(`DROP TABLE IF EXISTS "accounts_payable_settlements"`);
  }
}
