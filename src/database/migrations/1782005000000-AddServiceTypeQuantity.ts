import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cantidad por Tipo de Servicio.
 *
 * - `service_types.allowsQuantity` (boolean, default false): marca STs que
 *   pueden facturarse por cantidad (ej. sesiones de fisioterapia).
 * - `order_service_types.quantity` (int, default 1, CHECK >= 1): cantidad de
 *   ese ST dentro de la orden. Para STs sin `allowsQuantity` siempre es 1.
 *
 * Idempotente con IF NOT EXISTS / IF EXISTS.
 */
export class AddServiceTypeQuantity1782005000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "allowsQuantity" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "CHK_ost_quantity_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types"
       ADD CONSTRAINT "CHK_ost_quantity_positive" CHECK ("quantity" >= 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP CONSTRAINT IF EXISTS "CHK_ost_quantity_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "quantity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_types" DROP COLUMN IF EXISTS "allowsQuantity"`,
    );
  }
}
