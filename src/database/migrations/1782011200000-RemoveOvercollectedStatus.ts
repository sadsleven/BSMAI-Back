import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina el status `overcollected` de CxC. Las filas existentes con ese valor
 * pasan a `collected` (el sistema ya no distingue sobre-cobro: cobrar de más
 * simplemente deja el lote como "cobrado"). Se actualiza el CHECK `ck_ar_status`
 * para reflejar los tres valores válidos.
 */
export class RemoveOvercollectedStatus1782011200000
  implements MigrationInterface
{
  public async up(q: QueryRunner): Promise<void> {
    // Migrar datos: overcollected → collected (con collectedAt si no tiene).
    await q.query(
      `UPDATE "accounts_receivable"
         SET "status" = 'collected',
             "collectedAt" = COALESCE("collectedAt", now())
       WHERE "status" = 'overcollected'`,
    );

    // Reemplazar CHECK constraint.
    await q.query(`ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "ck_ar_status"`);
    await q.query(`
      ALTER TABLE "accounts_receivable"
        ADD CONSTRAINT "ck_ar_status"
        CHECK ("status" IN ('uncollected', 'partially_collected', 'collected'))
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "ck_ar_status"`);
    await q.query(`
      ALTER TABLE "accounts_receivable"
        ADD CONSTRAINT "ck_ar_status"
        CHECK ("status" IN ('uncollected', 'partially_collected', 'collected', 'overcollected'))
    `);
  }
}
