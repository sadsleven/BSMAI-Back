import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historial de cambios por usuario de cada orden.
 *
 * `order_change_logs`: una fila por acción relevante sobre la orden (creación,
 * edición del Paso 1, autorización de monto, atención, informe, facturación,
 * pagos, papelera/restauración). `changes` (jsonb) guarda el detalle por campo
 * `{ campo: { from, to } }` cuando aplica.
 *
 * FK a orders CASCADE (el hard-delete de la orden arrastra su historial) y a
 * users RESTRICT (no se puede hard-borrar un usuario con historial).
 *
 * Idempotente vía IF NOT EXISTS.
 */
export class AddOrderChangeLogs1782008500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "order_change_logs" (
         "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
         "orderId" uuid NOT NULL,
         "userId" uuid NOT NULL,
         "action" varchar(32) NOT NULL,
         "changes" jsonb NULL,
         "createdAt" timestamptz NOT NULL DEFAULT now(),
         CONSTRAINT "fk_ocl_order" FOREIGN KEY ("orderId")
           REFERENCES "orders"("id") ON DELETE CASCADE,
         CONSTRAINT "fk_ocl_user" FOREIGN KEY ("userId")
           REFERENCES "users"("id") ON DELETE RESTRICT
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ocl_order_created"
         ON "order_change_logs" ("orderId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ocl_order_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_change_logs"`);
  }
}
