import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convierte `orders.serviceTypeId` y `orders.pathologyId` (FKs escalares) en
 * relaciones M2M:
 *  - `order_service_types(orderId, serviceTypeId)` — siempre ≥ 1.
 *  - `order_pathologies(orderId, pathologyId)`     — 0..N.
 *
 * Backfill desde las columnas escalares antes de eliminarlas.
 */
export class OrderServiceTypesPathologiesM2M1782002300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Pivot order ↔ service_types
    await queryRunner.query(`
      CREATE TABLE "order_service_types" (
        "orderId" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "serviceTypeId" uuid NOT NULL REFERENCES "service_types"("id") ON DELETE RESTRICT,
        PRIMARY KEY ("orderId","serviceTypeId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ost_orderId" ON "order_service_types"("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ost_serviceTypeId" ON "order_service_types"("serviceTypeId")`,
    );

    // Pivot order ↔ pathologies
    await queryRunner.query(`
      CREATE TABLE "order_pathologies" (
        "orderId" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "pathologyId" uuid NOT NULL REFERENCES "pathologies"("id") ON DELETE RESTRICT,
        PRIMARY KEY ("orderId","pathologyId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_op_orderId" ON "order_pathologies"("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_op_pathologyId" ON "order_pathologies"("pathologyId")`,
    );

    // Backfill desde columnas escalares.
    await queryRunner.query(`
      INSERT INTO "order_service_types"("orderId","serviceTypeId")
      SELECT id, "serviceTypeId" FROM "orders" WHERE "serviceTypeId" IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "order_pathologies"("orderId","pathologyId")
      SELECT id, "pathologyId" FROM "orders" WHERE "pathologyId" IS NOT NULL
    `);

    // Drop FKs y columnas viejas. Postgres genera los nombres por FK.
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN (
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'orders'::regclass AND contype = 'f'
            AND (pg_get_constraintdef(oid) LIKE '%(serviceTypeId)%'
                 OR pg_get_constraintdef(oid) LIKE '%(pathologyId)%')
        ) LOOP
          EXECUTE 'ALTER TABLE "orders" DROP CONSTRAINT ' || quote_ident(r.conname);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "serviceTypeId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "pathologyId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restablece columnas escalares (nullable) y vuelca cualquier item del pivote.
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN "serviceTypeId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN "pathologyId" uuid NULL`,
    );
    await queryRunner.query(`
      UPDATE "orders" o SET "serviceTypeId" = (
        SELECT "serviceTypeId" FROM "order_service_types" ost WHERE ost."orderId" = o.id LIMIT 1
      )
    `);
    await queryRunner.query(`
      UPDATE "orders" o SET "pathologyId" = (
        SELECT "pathologyId" FROM "order_pathologies" op WHERE op."orderId" = o.id LIMIT 1
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_serviceType" FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_pathology" FOREIGN KEY ("pathologyId") REFERENCES "pathologies"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "order_pathologies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_service_types"`);
  }
}
