import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajuste (resta o suma) del monto a cobrar de un LOTE de cuentas por cobrar.
 *
 * Los seguros suelen pagar menos de lo facturado (descuentos, glosas): el lote
 * se ajusta para que el target refleje lo realmente exigible y pueda quedar
 * `collected` sin sobre/sub-cobro artificial. Espeja el ajuste de monto del
 * Paso 1 de la orden: monto firmado + motivo obligatorio + autor y fecha.
 *
 * `adjustmentAmount` está en la MONEDA DEL LOTE (Bs si el lote es de tasa fija,
 * USD si es indexado/USD) — el modo es uniforme por lote. Negativo = resta,
 * positivo = suma. NULL/0 = sin ajuste (y entonces motivo/autor quedan NULL).
 */
export class AddReceivableAdjustment1782009700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "adjustmentAmount" numeric(14,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "adjustmentNote" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "adjustedById" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "adjustedAt" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD CONSTRAINT "FK_ar_adjusted_by"
       FOREIGN KEY ("adjustedById") REFERENCES "users"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ar_adjusted_by" ON "accounts_receivable" ("adjustedById")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ar_adjusted_by"`);
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "FK_ar_adjusted_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP COLUMN IF EXISTS "adjustedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP COLUMN IF EXISTS "adjustedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP COLUMN IF EXISTS "adjustmentNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP COLUMN IF EXISTS "adjustmentAmount"`,
    );
  }
}
