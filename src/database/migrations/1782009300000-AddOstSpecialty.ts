import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Especialidad POR FILA de tipo de servicio.
 *
 * `order_service_types.specialtyId uuid NOT NULL` FK RESTRICT → `specialties`.
 *
 * Una orden puede combinar servicios de varias especialidades (ej. laboratorio
 * en un centro + rayos X en otro). Como cada proveedor distinto genera su propia
 * orden interna (`order_internal_orders`), la especialidad que se imprime en el
 * Paso 2 pasa a ser la de las filas de ESE proveedor, no una única por orden.
 *
 * `orders.specialtyId` se conserva como especialidad PRINCIPAL derivada
 * (= la de la primera fila): la siguen usando el filtro del listado, el
 * dashboard y los reportes. El backend la recalcula en create/update.
 *
 * Backfill: cada fila hereda la especialidad de su orden.
 * Idempotente vía IF NOT EXISTS / guardas por catálogo.
 */
export class AddOstSpecialty1782009300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types"
         ADD COLUMN IF NOT EXISTS "specialtyId" uuid`,
    );

    // Backfill desde la orden: hasta ahora la especialidad era una sola por orden.
    await queryRunner.query(
      `UPDATE "order_service_types" ost
          SET "specialtyId" = o."specialtyId"
         FROM "orders" o
        WHERE o.id = ost."orderId" AND ost."specialtyId" IS NULL`,
    );

    const pending = (await queryRunner.query(
      `SELECT count(*)::int AS nulls FROM "order_service_types" WHERE "specialtyId" IS NULL`,
    )) as Array<{ nulls: number }>;
    const nulls = Number(pending?.[0]?.nulls ?? 0);
    if (nulls > 0) {
      throw new Error(
        `order_service_types: ${nulls} filas sin specialtyId tras el backfill`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "order_service_types" ALTER COLUMN "specialtyId" SET NOT NULL`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_ost_specialty'
        ) THEN
          ALTER TABLE "order_service_types"
            ADD CONSTRAINT "FK_ost_specialty" FOREIGN KEY ("specialtyId")
            REFERENCES "specialties"(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ost_specialty" ON "order_service_types" ("specialtyId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ost_specialty"`);
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "FK_ost_specialty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "specialtyId"`,
    );
  }
}
