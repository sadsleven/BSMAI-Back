import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderBillingInvoiceControlNumbers1782007900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "invoiceNumber" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders"
         ADD COLUMN IF NOT EXISTS "controlNumber" varchar(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "controlNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "invoiceNumber"`,
    );
  }
}
