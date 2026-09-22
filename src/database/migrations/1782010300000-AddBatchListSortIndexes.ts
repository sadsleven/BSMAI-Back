import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices de orden para los listados de lotes (Cuentas por pagar, Retenciones
 * por pagar y Cuentas por cobrar).
 *
 * Los tres listados paginan con `ORDER BY <sortBy> <dir>, id` sobre filas no
 * borradas. Con sólo los índices por FK/estado, Postgres tenía que leer la
 * tabla entera y ordenarla en memoria para devolver 10 filas. Estos índices
 * parciales (`deletedAt IS NULL`) cubren los dos órdenes por defecto —
 * `createdAt` (el de la UI) y `updatedAt` — así que la página sale de un
 * index scan con LIMIT.
 *
 * El orden por número de lote ya está cubierto por el UNIQUE de
 * `payableNumber` / `taxBatchNumber` / `receivableNumber`.
 */
export class AddBatchListSortIndexes1782010300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_created_active"
         ON "accounts_payable" ("createdAt" DESC, "id" DESC)
         WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_updated_active"
         ON "accounts_payable" ("updatedAt" DESC, "id" DESC)
         WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ar_created_active"
         ON "accounts_receivable" ("createdAt" DESC, "id" DESC)
         WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ar_updated_active"
         ON "accounts_receivable" ("updatedAt" DESC, "id" DESC)
         WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tpb_created_active"
         ON "tax_payment_batches" ("createdAt" DESC, "id" DESC)
         WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tpb_updated_active"
         ON "tax_payment_batches" ("updatedAt" DESC, "id" DESC)
         WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ap_created_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ap_updated_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ar_created_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ar_updated_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tpb_created_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tpb_updated_active"`);
  }
}
