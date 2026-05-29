import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo Créditos por cobrar — espejo de accounts_receivable pero asociado
 * al titular (holder) de la orden, generado para órdenes type='credit'.
 *
 * Tablas:
 *  - `credits_receivable` (1 por orden, FK holder=patient RESTRICT).
 *  - `credits_receivable_payments`.
 *  - `credits_receivable_payment_links` (N:N).
 *
 * Sequence:
 *  - `credits_receivable_seq` para `creditNumber` human-readable.
 *
 * Backfill para órdenes existentes con type='credit'.
 */
export class CreateCreditsReceivable1782003700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS credits_receivable_seq START 1`);

    await queryRunner.query(`
      CREATE TABLE "credits_receivable" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "creditNumber" varchar(32) NOT NULL UNIQUE,
        "orderId" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
        "holderId" uuid NOT NULL REFERENCES "patients"("id") ON DELETE RESTRICT,
        "status" varchar(20) NOT NULL DEFAULT 'uncollected',
        "collectedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_cr_status" ON "credits_receivable"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_cr_holder" ON "credits_receivable"("holderId")`);

    await queryRunner.query(`
      CREATE TABLE "credits_receivable_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
        "type" varchar(24) NOT NULL,
        "paymentDate" date NOT NULL,
        "referenceNumber" varchar(20) NULL,
        "bankCode" varchar(8) NULL,
        "accountNumber" varchar(40) NULL,
        "exchangeRateId" uuid NULL REFERENCES "exchange_rates"("id") ON DELETE RESTRICT,
        "amountCurrency" varchar(3) NOT NULL,
        "amountValue" numeric(14,2) NOT NULL,
        "amountInBs" numeric(18,2) NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "credits_receivable_payment_links" (
        "creditId" uuid NOT NULL REFERENCES "credits_receivable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "credits_receivable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("creditId", "paymentId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_cr_links_credit" ON "credits_receivable_payment_links"("creditId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_cr_links_payment" ON "credits_receivable_payment_links"("paymentId")`,
    );

    // Backfill — órdenes existentes type='credit' sin cuenta de crédito.
    await queryRunner.query(`
      INSERT INTO "credits_receivable" ("creditNumber", "orderId", "holderId")
      SELECT nextval('credits_receivable_seq')::text, o.id, o."holderId"
      FROM "orders" o
      WHERE o."type" = 'credit'
        AND o."deletedAt" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "credits_receivable" cr WHERE cr."orderId" = o.id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "credits_receivable_payment_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credits_receivable_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credits_receivable"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS credits_receivable_seq`);
  }
}
