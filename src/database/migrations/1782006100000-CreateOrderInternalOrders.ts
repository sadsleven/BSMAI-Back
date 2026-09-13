import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Numeración por proveedor: una "orden interna" (con su propio número) por
 * proveedor distinto de cada orden.
 *
 * - Nueva tabla `order_internal_orders` (1 fila por proveedor distinto/orden),
 *   con `internalNumber` extraído de la secuencia compartida `orders_seq`.
 * - `orders.orderNumber` se mantiene como número BASE = `internalNumber` del
 *   proveedor `sequencePosition = 1` (congelado de por vida).
 * - `order_service_types.internalOrderId` (FK real, NOT NULL) liga cada fila de
 *   servicio a la orden interna de SU proveedor — así la facturación imprime el
 *   número correcto por fila sin re-matchear por proveedor.
 *
 * Backfill determinista desde `accounts_payable` (que hoy ya es exactamente una
 * fila por proveedor distinto/orden): por orden, las filas AP activas se ordenan
 * por (`createdAt`, `payableNumber::int`) — reproduce el orden de inserción
 * original. La primera hereda el `orders.orderNumber` existente (base ==
 * proveedor 1, sin cambio visible para órdenes de un solo proveedor); cada
 * proveedor siguiente extrae un `nextval('orders_seq')` fresco.
 */
export class CreateOrderInternalOrders1782006100000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // 1. Tabla + constraints + índices.
    await q.query(`
      CREATE TABLE "order_internal_orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "providerType" varchar(16) NOT NULL,
        "doctorId" uuid,
        "careCenterId" uuid,
        "internalNumber" varchar(32) NOT NULL,
        "sequencePosition" integer NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_iio_order"
          FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_iio_doctor"
          FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_iio_care_center"
          FOREIGN KEY ("careCenterId") REFERENCES "care_centers"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_iio_provider_xor" CHECK (
          ("providerType" = 'doctor' AND "doctorId" IS NOT NULL AND "careCenterId" IS NULL)
          OR
          ("providerType" = 'care_center' AND "careCenterId" IS NOT NULL AND "doctorId" IS NULL)
        )
      )
    `);
    // UNIQUE global del número (sin predicado deletedAt: la tabla es dura).
    await q.query(
      `CREATE UNIQUE INDEX "uq_iio_internal_number" ON "order_internal_orders" ("internalNumber")`,
    );
    // Orden numérico correcto en listados (evita la anomalía '10' < '2').
    await q.query(
      `CREATE INDEX "idx_iio_internal_number_int" ON "order_internal_orders" (("internalNumber"::int))`,
    );
    await q.query(
      `CREATE INDEX "IDX_iio_order" ON "order_internal_orders" ("orderId")`,
    );
    // A lo sumo una orden interna por (orden, proveedor).
    await q.query(`
      CREATE UNIQUE INDEX "uq_iio_order_doctor"
      ON "order_internal_orders" ("orderId", "doctorId")
      WHERE "doctorId" IS NOT NULL
    `);
    await q.query(`
      CREATE UNIQUE INDEX "uq_iio_order_care_center"
      ON "order_internal_orders" ("orderId", "careCenterId")
      WHERE "careCenterId" IS NOT NULL
    `);

    // 2. Backfill desde accounts_payable activas (grano per-proveedor actual).
    const aps: Array<{
      orderId: string;
      orderNumber: string;
      recipientType: 'doctor' | 'care_center';
      doctorId: string | null;
      careCenterId: string | null;
    }> = await q.query(`
      SELECT ap."orderId", o."orderNumber", ap."recipientType",
             ap."doctorId", ap."careCenterId"
      FROM "accounts_payable" ap
      JOIN "orders" o ON o."id" = ap."orderId"
      WHERE ap."deletedAt" IS NULL
      ORDER BY o."orderNumber"::int, ap."createdAt", ap."payableNumber"::int
    `);

    let currentOrder: string | null = null;
    let pos = 0;
    for (const ap of aps) {
      if (ap.orderId !== currentOrder) {
        currentOrder = ap.orderId;
        pos = 0;
      }
      pos += 1;
      let internalNumber: string;
      if (pos === 1) {
        // base == proveedor 1: hereda el número existente de la orden.
        internalNumber = String(ap.orderNumber);
      } else {
        const r: Array<{ nextval: string }> = await q.query(
          `SELECT nextval('orders_seq') AS nextval`,
        );
        internalNumber = String(r[0].nextval);
      }
      await q.query(
        `INSERT INTO "order_internal_orders"
           ("orderId", "providerType", "doctorId", "careCenterId", "internalNumber", "sequencePosition")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          ap.orderId,
          ap.recipientType,
          ap.doctorId,
          ap.careCenterId,
          internalNumber,
          pos,
        ],
      );
    }

    // 3. order_service_types.internalOrderId (FK real, NOT NULL).
    await q.query(
      `ALTER TABLE "order_service_types" ADD COLUMN "internalOrderId" uuid`,
    );
    await q.query(`
      UPDATE "order_service_types" ost
      SET "internalOrderId" = iio."id"
      FROM "order_internal_orders" iio
      WHERE iio."orderId" = ost."orderId"
        AND iio."providerType" = ost."providerType"
        AND COALESCE(iio."doctorId", iio."careCenterId")
            = COALESCE(ost."doctorId", ost."careCenterId")
    `);
    const nullOst: Array<{ c: number }> = await q.query(
      `SELECT count(*)::int AS c FROM "order_service_types" WHERE "internalOrderId" IS NULL`,
    );
    if (nullOst[0].c > 0) {
      throw new Error(
        `Backfill incompleto: ${nullOst[0].c} order_service_types sin internalOrderId`,
      );
    }
    await q.query(
      `ALTER TABLE "order_service_types" ALTER COLUMN "internalOrderId" SET NOT NULL`,
    );
    await q.query(`
      ALTER TABLE "order_service_types"
      ADD CONSTRAINT "fk_ost_internal_order"
      FOREIGN KEY ("internalOrderId") REFERENCES "order_internal_orders"("id")
      ON DELETE CASCADE
    `);
    await q.query(
      `CREATE INDEX "IDX_ost_internalOrder" ON "order_service_types" ("internalOrderId")`,
    );

    // 4. Aserciones post-condición (lanzan -> rollback si algo no cuadra).
    const a1: Array<{ c: number }> = await q.query(
      `SELECT count(*)::int AS c FROM "order_internal_orders"
       WHERE "internalNumber" IS NULL OR "internalNumber" !~ '^[0-9]+$'`,
    );
    if (a1[0].c > 0)
      throw new Error('internalNumber inválido en order_internal_orders');

    const a2: Array<{ total: number; uniq: number }> = await q.query(
      `SELECT count(*)::int AS total, count(DISTINCT "internalNumber")::int AS uniq
       FROM "order_internal_orders"`,
    );
    if (a2[0].total !== a2[0].uniq) throw new Error('internalNumber duplicado');

    const a3: Array<{ c: number }> = await q.query(`
      SELECT count(*)::int AS c FROM "orders" o
      WHERE NOT EXISTS (
        SELECT 1 FROM "order_internal_orders" iio
        WHERE iio."orderId" = o."id"
          AND iio."sequencePosition" = 1
          AND iio."internalNumber" = o."orderNumber"
      )
    `);
    if (a3[0].c > 0)
      throw new Error(`base != proveedor 1 en ${a3[0].c} órdenes`);

    const a4: Array<{ c: number }> = await q.query(`
      SELECT count(*)::int AS c FROM (
        SELECT o."id",
          (SELECT count(DISTINCT ost2."providerType" || ':' ||
                          COALESCE(ost2."doctorId"::text, ost2."careCenterId"::text))
             FROM "order_service_types" ost2 WHERE ost2."orderId" = o."id") AS prov,
          (SELECT count(*) FROM "order_internal_orders" iio WHERE iio."orderId" = o."id") AS iio
        FROM "orders" o
      ) t WHERE prov <> iio
    `);
    if (a4[0].c > 0) {
      throw new Error(
        `conteo proveedores != internal_orders en ${a4[0].c} órdenes`,
      );
    }

    const a5: Array<{ seq: number; mx: number }> = await q.query(
      `SELECT (SELECT last_value FROM orders_seq)::int AS seq,
              COALESCE(max("internalNumber"::int), 0)::int AS mx
       FROM "order_internal_orders"`,
    );
    if (a5[0].seq < a5[0].mx) {
      throw new Error('orders_seq quedó por debajo del max internalNumber');
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "fk_ost_internal_order"`,
    );
    await q.query(`DROP INDEX IF EXISTS "IDX_ost_internalOrder"`);
    await q.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "internalOrderId"`,
    );
    await q.query(`DROP TABLE IF EXISTS "order_internal_orders"`);
    // orders_seq NO se retrocede: los números emitidos quedan quemados (unicidad global).
  }
}
