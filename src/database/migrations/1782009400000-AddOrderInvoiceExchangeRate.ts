import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tasa de la FACTURA elegida en el Paso 4.
 *
 *  - `orders.invoiceExchangeRateId uuid NULL` FK `exchange_rates` RESTRICT.
 *    Es la tasa USD/Bs que el usuario selecciona al facturar y con la que se
 *    imprime la factura (celda "Tasa de cambio BCV" + todos los montos en Bs).
 *
 *  Se agrega como columna aparte de `billingExchangeRateId` a propósito: las
 *  órdenes ya finalizadas tienen `billingExchangeRateId` = tasa vigente al
 *  momento de finalizar (snapshot automático), mientras que su factura se
 *  imprimió con la tasa fija / la del pago dominante. Dejar `NULL` en esas
 *  filas conserva intacta la factura histórica; sólo las órdenes facturadas de
 *  aquí en adelante llevan la tasa elegida y ésta tiene precedencia.
 *
 *  Al facturar, el service escribe la MISMA tasa en `invoiceExchangeRateId`,
 *  `billingExchangeRateId` (conversión a Bs de CxP / retenciones / reportes) y,
 *  si la orden es de seguro no indexado, en `fixedExchangeRateId` (target Bs de
 *  la cuenta por cobrar) — el campo de tasa que antes vivía en el Paso 1.
 */
export class AddOrderInvoiceExchangeRate1782009400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "invoiceExchangeRateId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_invoice_exchange_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD CONSTRAINT "FK_orders_invoice_exchange_rate"
         FOREIGN KEY ("invoiceExchangeRateId") REFERENCES "exchange_rates"("id") ON DELETE RESTRICT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_invoice_exchange_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "invoiceExchangeRateId"`,
    );
  }
}
