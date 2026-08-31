import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ¿La factura imprime la fila "Tasa de cambio BCV"? Hasta ahora era una regla
 * fija: se imprimía salvo en órdenes con tasa fija (`orders.useFixedRate`, o
 * sea seguro "no indexado"). El Paso 4 ahora deja **elegirlo con un switch** en
 * las órdenes de seguro.
 *
 *  - `orders.invoiceShowExchangeRate boolean NULL` = ESPEJO de la elección de la
 *    factura vigente (lo lee el generador Excel/PDF).
 *  - `order_invoices.showExchangeRate boolean NULL` = snapshot por factura, para
 *    que una reemisión conserve su propia elección.
 *
 * `NULL` = sin elección explícita ⇒ vale la regla derivada de siempre
 * (`!useFixedRate`). Por eso las órdenes ya facturadas NO se backfillean: su
 * factura histórica sale exactamente igual que antes.
 */
export class AddInvoiceShowExchangeRate1782009800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "invoiceShowExchangeRate" boolean NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_invoices"
         ADD COLUMN IF NOT EXISTS "showExchangeRate" boolean NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_invoices" DROP COLUMN IF EXISTS "showExchangeRate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "invoiceShowExchangeRate"`,
    );
  }
}
