import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelo Pendientes + Lotes (paso 1/4).
 *
 * El monto a pagar a cada proveedor (antes `accounts_payable.providerAmount`)
 * baja a la orden interna (`order_internal_orders.providerAmountUsd`). Es la
 * "unidad de deuda" / pendiente del módulo Cuentas por pagar. Se escribe en el
 * Paso 4 (`OrdersService.billing`) y se consume al armar un lote de pago.
 */
export class AddProviderAmountToInternalOrders1782006200000
  implements MigrationInterface
{
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "order_internal_orders" ADD COLUMN IF NOT EXISTS "providerAmountUsd" numeric(14,2) NULL`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "order_internal_orders" DROP COLUMN IF EXISTS "providerAmountUsd"`,
    );
  }
}
