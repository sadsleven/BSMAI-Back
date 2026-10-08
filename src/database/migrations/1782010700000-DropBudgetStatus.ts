import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quita el ciclo de aprobación del presupuesto.
 *
 * El presupuesto no se "aprueba" ni se "rechaza" en el sistema: se arma, se
 * entrega (Excel/PDF) y, si el paciente o el seguro lo acepta, se usa para
 * crear la orden. Ese es el único hito que el sistema puede comprobar, y ya
 * vive en `convertedOrderId` / `convertedAt`.
 *
 * Caen `status`, `sentAt`, `decidedAt` y `rejectReason` con sus CHECK e índice.
 *
 * `down` los restaura dejando todo en 'draft' — la decisión que hubiera habido
 * no se puede recuperar porque nunca se guardó en otro lado.
 */
export class DropBudgetStatus1782010700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets" DROP CONSTRAINT IF EXISTS "ck_budgets_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" DROP CONSTRAINT IF EXISTS "ck_budgets_reject_reason"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_budgets_status"`);
    await queryRunner.query(
      `ALTER TABLE "budgets"
         DROP COLUMN IF EXISTS "status",
         DROP COLUMN IF EXISTS "sentAt",
         DROP COLUMN IF EXISTS "decidedAt",
         DROP COLUMN IF EXISTS "rejectReason"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets"
         ADD COLUMN IF NOT EXISTS "status" varchar(16) NOT NULL DEFAULT 'draft',
         ADD COLUMN IF NOT EXISTS "sentAt" timestamptz NULL,
         ADD COLUMN IF NOT EXISTS "decidedAt" timestamptz NULL,
         ADD COLUMN IF NOT EXISTS "rejectReason" varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "ck_budgets_status"
         CHECK ("status" IN ('draft', 'sent', 'approved', 'rejected'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "ck_budgets_reject_reason"
         CHECK ("status" <> 'rejected' OR "rejectReason" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_budgets_status" ON "budgets" ("status")`,
    );
  }
}
