import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lotes de Cuentas por cobrar Cashea: el deudor real es Cashea (la fintech),
 * no el titular, por lo que un lote puede agrupar órdenes `type='cashea'` de
 * titulares distintos. Se modela con `insuranceId` y `holderId` ambos NULL.
 *
 * Relaja `ck_ar_debtor_xor`: de "exactamente uno" a "a lo sumo uno" de
 * (insuranceId, holderId). Ambos NULL = lote Cashea.
 */
export class AllowCasheaReceivableBatch1782008000000 implements MigrationInterface {
  name = 'AllowCasheaReceivableBatch1782008000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "ck_ar_debtor_xor"`,
    );
    await q.query(
      `ALTER TABLE "accounts_receivable" ADD CONSTRAINT "ck_ar_debtor_xor" CHECK (
        NOT ("insuranceId" IS NOT NULL AND "holderId" IS NOT NULL)
      )`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    // Los lotes Cashea (ambos NULL) violarían el XOR estricto: anularlos antes
    // de revertir. Aquí se eliminan sus pivots/pagos y el lote (borrado físico).
    await q.query(`
      DELETE FROM "accounts_receivable_payments" p
      USING "accounts_receivable_payment_links" l, "accounts_receivable" ar
      WHERE l."paymentId" = p.id AND l."receivableId" = ar.id
        AND ar."insuranceId" IS NULL AND ar."holderId" IS NULL
    `);
    await q.query(`
      DELETE FROM "accounts_receivable_orders" aro
      USING "accounts_receivable" ar
      WHERE aro."receivableId" = ar.id
        AND ar."insuranceId" IS NULL AND ar."holderId" IS NULL
    `);
    await q.query(
      `DELETE FROM "accounts_receivable" WHERE "insuranceId" IS NULL AND "holderId" IS NULL`,
    );
    await q.query(
      `ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "ck_ar_debtor_xor"`,
    );
    await q.query(
      `ALTER TABLE "accounts_receivable" ADD CONSTRAINT "ck_ar_debtor_xor" CHECK (
        ("insuranceId" IS NOT NULL AND "holderId" IS NULL)
        OR
        ("holderId" IS NOT NULL AND "insuranceId" IS NULL)
      )`,
    );
  }
}
