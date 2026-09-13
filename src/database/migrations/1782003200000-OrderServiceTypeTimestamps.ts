import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega `createdAt` y `updatedAt` a `order_service_types`.
 * Originalmente la tabla era un JoinTable simple sin timestamps; al promoverla
 * a entity propia las columnas faltaban.
 */
export class OrderServiceTypeTimestamps1782003200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ADD COLUMN IF NOT EXISTS "createdAt" timestamptz NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "updatedAt"`,
    );
  }
}
