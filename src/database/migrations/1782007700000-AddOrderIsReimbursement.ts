import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Órdenes de reembolso (sólo `type='credit'`).
 *
 * `orders.isReimbursement boolean NOT NULL DEFAULT false`. Marca una orden de
 * crédito como reembolso; en ese caso la orden interna (Paso 2) muestra "R" en
 * la celda de Clave de Servicio. CHECK: sólo puede ser true en crédito.
 *
 * Idempotente vía IF NOT EXISTS / IF EXISTS.
 */
export class AddOrderIsReimbursement1782007700000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "isReimbursement" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_reimbursement_only_credit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_reimbursement_only_credit" CHECK (
         "isReimbursement" = false OR type = 'credit'
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "chk_orders_reimbursement_only_credit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "isReimbursement"`,
    );
  }
}
