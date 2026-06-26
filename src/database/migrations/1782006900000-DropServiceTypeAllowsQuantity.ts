import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Todo Tipo de Servicio admite cantidad ahora. Se elimina el flag
 * `service_types.allowsQuantity` (ya no condiciona nada). La columna
 * `order_service_types.quantity` (≥1, default 1) se conserva.
 */
export class DropServiceTypeAllowsQuantity1782006900000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_types" DROP COLUMN IF EXISTS "allowsQuantity"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "service_types" ADD COLUMN IF NOT EXISTS "allowsQuantity" boolean NOT NULL DEFAULT false`,
    );
  }
}
