import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Order.serviceKey — texto libre opcional (≤30 chars). Aplicable sólo a órdenes
 * tipo seguro. No se valida unicidad ni se indexa: es metadata externa.
 */
export class AddOrderServiceKey1782003300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "serviceKey" varchar(30) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "serviceKey"`);
  }
}
