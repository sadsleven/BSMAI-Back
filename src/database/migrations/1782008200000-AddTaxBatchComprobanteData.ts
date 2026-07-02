import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Datos del comprobante ISLR del lote SENIAT (N° de comprobante + fecha de
 * emisión). Los captura el usuario en el detalle del lote y se persisten para
 * regenerar el mismo documento después.
 */
export class AddTaxBatchComprobanteData1782008200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tax_payment_batches" ADD COLUMN IF NOT EXISTS "comprobanteNumber" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_payment_batches" ADD COLUMN IF NOT EXISTS "comprobanteIssueDate" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tax_payment_batches" DROP COLUMN IF EXISTS "comprobanteIssueDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tax_payment_batches" DROP COLUMN IF EXISTS "comprobanteNumber"`,
    );
  }
}
