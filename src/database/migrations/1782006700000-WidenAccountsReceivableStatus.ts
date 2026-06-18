import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `accounts_receivable.status` nació como `varchar(16)` en
 * `1782006400000-RestructureAccountsReceivableBatches`, pero el valor
 * `'partially_collected'` mide 19 caracteres → al recalcular el estado en
 * `recomputeStatus` Postgres lanza `22001 value too long for type
 * character varying(16)`. Se amplía a `varchar(32)` (misma convención que los
 * `*Number`). El CHECK `ck_ar_status` y el índice `idx_ar_status` sobreviven al
 * cambio de tipo.
 */
export class WidenAccountsReceivableStatus1782006700000
  implements MigrationInterface
{
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "accounts_receivable" ALTER COLUMN "status" TYPE varchar(32)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    // Trunca cualquier fila demasiado larga para no romper el ALTER de vuelta.
    await q.query(
      `UPDATE "accounts_receivable" SET "status" = 'partially' WHERE "status" = 'partially_collected'`,
    );
    await q.query(
      `ALTER TABLE "accounts_receivable" ALTER COLUMN "status" TYPE varchar(16)`,
    );
  }
}
