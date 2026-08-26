import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cancelación de órdenes (alternativa al borrado, para no quemar números).
 *
 * En vez de eliminar una orden que quedó sin efecto (lo que abre un hueco
 * definitivo en `orders_seq` y rompe la secuencia visible de números), la orden
 * pasa a `status='cancelled'` conservando su número y todo su contenido. La
 * cancelación es REVERSIBLE: `statusBeforeCancel` guarda el estado del que se
 * canceló para restaurarlo al reactivar.
 *
 *  - `cancelledAt`        cuándo se canceló (NULL = orden activa).
 *  - `cancelReason`       motivo obligatorio de la cancelación (≤500).
 *  - `cancelledById`      quién la canceló (FK users RESTRICT).
 *  - `statusBeforeCancel` estado previo, para revertir sin adivinar.
 *
 * Todas las columnas se limpian al reactivar la orden (el historial queda en
 * `order_change_logs`, acciones `cancel` / `uncancel`).
 *
 * Idempotente vía IF NOT EXISTS.
 */
export class AddOrderCancellation1782009000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelReason" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelledById" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "statusBeforeCancel" varchar(24) NULL`,
    );
    await queryRunner.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_cancelled_by'
         ) THEN
           ALTER TABLE "orders"
             ADD CONSTRAINT "fk_orders_cancelled_by"
             FOREIGN KEY ("cancelledById") REFERENCES "users"("id")
             ON DELETE RESTRICT;
         END IF;
       END $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "fk_orders_cancelled_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "statusBeforeCancel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "cancelledById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "cancelReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "cancelledAt"`,
    );
  }
}
