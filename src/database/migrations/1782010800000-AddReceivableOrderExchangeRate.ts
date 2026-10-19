import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tasa USD/Bs POR ORDEN dentro de un lote de Cuentas por cobrar.
 *
 * `accounts_receivable_orders.exchangeRateId uuid NULL` → `exchange_rates`.
 * En los lotes de seguro "No indexado" (modo tasa fija) cada orden trae su
 * propia tasa amarrada (`orders.fixedExchangeRateId`): el lote NO tiene una
 * tasa única. Hasta ahora el pivot sólo guardaba el `targetBs` resultante y
 * los cobros se convertían con la tasa de la PRIMERA orden del lote, lo que
 * descuadraba el cobro cuando las órdenes tenían tasas distintas.
 *
 * Con esta columna la tasa de cada fila queda explícita y es ajustable desde
 * el detalle del lote (`PATCH /accounts-receivable/:id/orders/:orderId/rate`),
 * que recalcula sólo el `targetBs` de esa fila (`targetUsd × amountBs`).
 *
 * Backfill:
 *  - `targetUsd` de filas tasa fija legacy que quedaron NULL (se necesita para
 *    recalcular el `targetBs` al cambiar la tasa).
 *  - `exchangeRateId` desde la tasa fija de la orden.
 *
 * Idempotente vía IF NOT EXISTS / IF EXISTS.
 */
export class AddReceivableOrderExchangeRate1782010800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_orders"
         ADD COLUMN IF NOT EXISTS "exchangeRateId" uuid NULL
         REFERENCES "exchange_rates"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_aro_exchangeRate"
         ON "accounts_receivable_orders"("exchangeRateId")`,
    );
    // Filas 'full' a tasa fija sin snapshot USD: el monto es el precio de la orden.
    await queryRunner.query(
      `UPDATE "accounts_receivable_orders" aro
          SET "targetUsd" = ROUND(o."priceAmount", 2)
         FROM "orders" o
        WHERE o.id = aro."orderId"
          AND aro."useFixedRate" = true
          AND aro."portion" = 'full'
          AND aro."targetUsd" IS NULL`,
    );
    // Filas de porción fija sin snapshot USD: derivar del targetBs y la tasa.
    await queryRunner.query(
      `UPDATE "accounts_receivable_orders" aro
          SET "targetUsd" = ROUND(aro."targetBs" / fx."amountBs", 2)
         FROM "orders" o
         JOIN "exchange_rates" fx ON fx.id = o."fixedExchangeRateId"
        WHERE o.id = aro."orderId"
          AND aro."useFixedRate" = true
          AND aro."targetUsd" IS NULL
          AND aro."targetBs" IS NOT NULL
          AND fx."amountBs" > 0`,
    );
    await queryRunner.query(
      `UPDATE "accounts_receivable_orders" aro
          SET "exchangeRateId" = o."fixedExchangeRateId"
         FROM "orders" o
        WHERE o.id = aro."orderId"
          AND aro."useFixedRate" = true
          AND aro."exchangeRateId" IS NULL
          AND o."fixedExchangeRateId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_aro_exchangeRate"`);
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable_orders"
         DROP COLUMN IF EXISTS "exchangeRateId"`,
    );
  }
}
