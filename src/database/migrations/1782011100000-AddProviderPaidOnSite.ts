import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Órdenes de contado en las que al proveedor se le paga en el acto: no generan
 * deuda, así que quedan fuera de Cuentas por pagar y de su reporte. Se marca al
 * facturar (Paso 4) y se puede corregir mientras la obligación no esté en un lote.
 */
export class AddProviderPaidOnSite1782011100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_internal_orders"
         ADD COLUMN IF NOT EXISTS "providerPaidOnSite" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_internal_orders"
         ADD COLUMN IF NOT EXISTS "providerPaidOnSiteAt" timestamptz`,
    );
    // El filtro de "pendientes" de CxP recorre todas las obligaciones facturadas.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_iio_provider_paid_on_site"
         ON "order_internal_orders" ("providerPaidOnSite")
       WHERE "providerPaidOnSite" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_iio_provider_paid_on_site"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_internal_orders" DROP COLUMN IF EXISTS "providerPaidOnSiteAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_internal_orders" DROP COLUMN IF EXISTS "providerPaidOnSite"`,
    );
  }
}
