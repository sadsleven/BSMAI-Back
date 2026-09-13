import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `order_service_types.customName` (varchar(300), nullable): nombre
 * personalizado del ST dentro de la orden (override de `serviceType.name`).
 * Lo fija el usuario en el Paso 1; se usa en Paso 1/2/4 y en el detalle.
 */
export class AddCustomNameToOrderServiceTypes1782007000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ADD COLUMN IF NOT EXISTS "customName" varchar(300) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "customName"`,
    );
  }
}
