import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fecha de factura de la orden (Paso 4).
 *
 * `orders.invoiceDate date NULL` = fecha que se imprime en la factura
 * ("Fecha de Emisión"), independiente de `orders.orderDate` (fecha de creación
 * de la orden del Paso 1). Se ingresa en la card "Factura" del Paso 4 y por
 * defecto toma `orderDate`.
 *
 * Backfill: órdenes ya facturadas (`invoiceNumber` no nulo) heredan su
 * `orderDate` para no cambiar el documento ya emitido. El resto queda NULL y
 * cae al `orderDate` al facturar.
 *
 * Idempotente vía IF NOT EXISTS.
 */
export class AddOrderInvoiceDate1782008900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "invoiceDate" date NULL`,
    );
    await queryRunner.query(
      `UPDATE "orders"
          SET "invoiceDate" = "orderDate"
        WHERE "invoiceDate" IS NULL AND "invoiceNumber" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "invoiceDate"`,
    );
  }
}
