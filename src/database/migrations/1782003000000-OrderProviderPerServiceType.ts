import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mueve `providerType`, `doctorId`, `careCenterId` de `orders` a `order_service_types`.
 * Cada Tipo de Servicio dentro de una orden tiene su propio proveedor.
 *
 *  1. Agrega columnas `providerType`, `doctorId`, `careCenterId` (nullable durante backfill)
 *     a `order_service_types`.
 *  2. Backfill desde `orders`.
 *  3. NOT NULL en `providerType`. CHECK constraint para que exactamente uno de
 *     `doctorId` o `careCenterId` esté presente, coherente con `providerType`.
 *  4. FKs RESTRICT a `doctors` y `care_centers`.
 *  5. Drop columnas en `orders`.
 *  6. `accounts_payable`: drop UNIQUE(orderId); crea dos índices únicos parciales para
 *     evitar duplicar payables por (orden, mismo proveedor) pero permitir N por orden.
 *
 * Idempotente con IF EXISTS / IF NOT EXISTS.
 */
export class OrderProviderPerServiceType1782003000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Columns
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ADD COLUMN IF NOT EXISTS "providerType" varchar(16) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ADD COLUMN IF NOT EXISTS "doctorId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ADD COLUMN IF NOT EXISTS "careCenterId" uuid NULL`,
    );

    // 2) Backfill
    const ordersHaveProvider = (await queryRunner.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'orders' AND column_name = 'providerType'
       ) AS exists`,
    )) as Array<{ exists: boolean }>;
    if (ordersHaveProvider[0]?.exists) {
      await queryRunner.query(`
        UPDATE "order_service_types" ost
        SET "providerType" = o."providerType",
            "doctorId"     = o."doctorId",
            "careCenterId" = o."careCenterId"
        FROM "orders" o
        WHERE ost."orderId" = o.id
          AND ost."providerType" IS NULL
      `);
    }

    // 3) NOT NULL + CHECK
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ALTER COLUMN "providerType" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "CHK_ost_provider_xor"`,
    );
    await queryRunner.query(`
      ALTER TABLE "order_service_types"
      ADD CONSTRAINT "CHK_ost_provider_xor"
      CHECK (
        ("providerType" = 'doctor' AND "doctorId" IS NOT NULL AND "careCenterId" IS NULL)
        OR
        ("providerType" = 'care_center' AND "careCenterId" IS NOT NULL AND "doctorId" IS NULL)
      )
    `);

    // 4) FKs
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "FK_ost_doctor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types"
       ADD CONSTRAINT "FK_ost_doctor"
       FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "FK_ost_careCenter"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types"
       ADD CONSTRAINT "FK_ost_careCenter"
       FOREIGN KEY ("careCenterId") REFERENCES "care_centers"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ost_doctor" ON "order_service_types"("doctorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ost_careCenter" ON "order_service_types"("careCenterId")`,
    );

    // 5) Drop columns on orders
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "providerType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "doctorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "careCenterId"`,
    );

    // 6) accounts_payable: drop UNIQUE(orderId), agregar parciales.
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP CONSTRAINT IF EXISTS "accounts_payable_orderId_key"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ap_order_doctor"
       ON "accounts_payable"("orderId","doctorId")
       WHERE "doctorId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ap_order_careCenter"
       ON "accounts_payable"("orderId","careCenterId")
       WHERE "careCenterId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversa best-effort. Nota: la reversión no preserva órdenes con múltiples proveedores
    // ya que `orders` no puede albergar más de uno; se toma el primero por order.
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ap_order_doctor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ap_order_careCenter"`);
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_orderId_key" UNIQUE ("orderId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "providerType" varchar(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "doctorId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "careCenterId" uuid`,
    );

    // Reverse-backfill — toma el primer ST por orden.
    await queryRunner.query(`
      UPDATE "orders" o
      SET "providerType" = sub."providerType",
          "doctorId"     = sub."doctorId",
          "careCenterId" = sub."careCenterId"
      FROM (
        SELECT DISTINCT ON ("orderId")
          "orderId", "providerType", "doctorId", "careCenterId"
        FROM "order_service_types"
        ORDER BY "orderId", "providerType"
      ) sub
      WHERE o.id = sub."orderId"
    `);

    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "CHK_ost_provider_xor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "FK_ost_doctor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "FK_ost_careCenter"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ost_doctor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ost_careCenter"`);
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "careCenterId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "doctorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "providerType"`,
    );
  }
}
