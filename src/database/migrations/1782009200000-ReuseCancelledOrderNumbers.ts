import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reutilización de números de órdenes CANCELADAS.
 *
 * Una orden cancelada conserva su número (la factura ya emitida lo lleva), pero
 * ese número deja de estar "en uso": se puede volver a elegir a mano en el
 * Paso 1 o en "Cambiar número". Para que el UNIQUE no lo impida, los índices
 * únicos pasan a ser PARCIALES sobre las filas vivas:
 *
 * - `orders`: unique de `orderNumber` → `WHERE status <> 'cancelled'`.
 * - `order_internal_orders`: unique de `internalNumber` → `WHERE NOT cancelled`.
 *
 * `order_internal_orders` no tiene estado propio, así que se agrega la columna
 * denormalizada `cancelled` (espejo de `orders.status = 'cancelled'`, la
 * mantienen `OrdersService.cancel`/`uncancel`): un índice parcial no puede
 * mirar otra tabla.
 *
 * La numeración AUTOMÁTICA no cambia: `orders_seq` y la marca de agua siguen
 * contando las canceladas, así que el rango automático nunca reparte un número
 * que una cancelada todavía muestra. La reutilización es siempre manual.
 */
export class ReuseCancelledOrderNumbers1782009200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_internal_orders"
         ADD COLUMN IF NOT EXISTS "cancelled" boolean NOT NULL DEFAULT false`,
    );
    // Backfill: órdenes internas de órdenes ya canceladas.
    await queryRunner.query(
      `UPDATE "order_internal_orders" iio
          SET "cancelled" = true
         FROM "orders" o
        WHERE o.id = iio."orderId"
          AND o.status = 'cancelled'
          AND iio."cancelled" = false`,
    );

    // --- order_internal_orders: unique global → unique parcial (filas vivas) ---
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_iio_internal_number"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_iio_internal_number_active"
         ON "order_internal_orders" ("internalNumber")
       WHERE "cancelled" = false`,
    );
    // Consultas de numeración: filtran por vivas antes de comparar el número.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_iio_internal_number_num_active"
         ON "order_internal_orders" ((("internalNumber")::bigint))
       WHERE "internalNumber" ~ '^[0-9]+$' AND "cancelled" = false`,
    );

    // --- orders: el unique de `orderNumber` puede venir como CONSTRAINT
    // (generado por TypeORM, nombre `UQ_...`) o como índice suelto. Se busca
    // por definición, no por nombre. ---
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT con.conname AS name
            FROM pg_constraint con
            JOIN pg_class t ON t.oid = con.conrelid
            JOIN pg_namespace ns ON ns.oid = t.relnamespace
           WHERE t.relname = 'orders'
             AND ns.nspname = current_schema()
             AND con.contype = 'u'
             AND pg_get_constraintdef(con.oid) = 'UNIQUE ("orderNumber")'
        LOOP
          EXECUTE format('ALTER TABLE "orders" DROP CONSTRAINT %I', r.name);
        END LOOP;
        FOR r IN
          SELECT i.indexname AS name
            FROM pg_indexes i
           WHERE i.tablename = 'orders'
             AND i.schemaname = current_schema()
             AND i.indexdef LIKE '%UNIQUE%'
             AND i.indexdef LIKE '%("orderNumber")%'
             AND i.indexdef NOT LIKE '%WHERE%'
        LOOP
          EXECUTE format('DROP INDEX %I', r.name);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_orders_order_number_active"
         ON "orders" ("orderNumber")
       WHERE status <> 'cancelled'`,
    );

    // Guardas: la columna espejo quedó consistente con el estado de la orden.
    const drift = (await queryRunner.query(
      `SELECT count(*)::text AS c
         FROM "order_internal_orders" iio
         JOIN "orders" o ON o.id = iio."orderId"
        WHERE iio."cancelled" <> (o.status = 'cancelled')`,
    )) as Array<{ c: string }>;
    if (Number(drift[0].c) > 0) {
      throw new Error(
        'order_internal_orders."cancelled" no coincide con orders.status',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volver al UNIQUE global sólo es posible si nadie reutilizó un número de
    // una orden cancelada; si hay duplicados hay que renumerar a mano primero.
    const dupIio = (await queryRunner.query(
      `SELECT "internalNumber" AS n
         FROM "order_internal_orders"
        GROUP BY "internalNumber" HAVING count(*) > 1
        ORDER BY 1`,
    )) as Array<{ n: string }>;
    if (dupIio.length) {
      throw new Error(
        `No se puede restaurar el UNIQUE global de order_internal_orders."internalNumber": números duplicados (${dupIio
          .map((r) => r.n)
          .join(', ')}). Renumera esas órdenes antes de revertir.`,
      );
    }
    const dupOrders = (await queryRunner.query(
      `SELECT "orderNumber" AS n
         FROM "orders"
        GROUP BY "orderNumber" HAVING count(*) > 1
        ORDER BY 1`,
    )) as Array<{ n: string }>;
    if (dupOrders.length) {
      throw new Error(
        `No se puede restaurar el UNIQUE global de orders."orderNumber": números duplicados (${dupOrders
          .map((r) => r.n)
          .join(', ')}). Renumera esas órdenes antes de revertir.`,
      );
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_orders_order_number_active"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD CONSTRAINT "UQ_orders_orderNumber" UNIQUE ("orderNumber")`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_iio_internal_number_num_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_iio_internal_number_active"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_iio_internal_number"
         ON "order_internal_orders" ("internalNumber")`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_internal_orders" DROP COLUMN IF EXISTS "cancelled"`,
    );
  }
}
