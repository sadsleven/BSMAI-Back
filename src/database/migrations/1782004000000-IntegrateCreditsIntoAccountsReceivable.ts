import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Integra el módulo Créditos por cobrar dentro de Cuentas por cobrar.
 *
 * Cambios:
 *  - `accounts_receivable.holderId uuid NULL` (FK patients RESTRICT). Deudor=titular.
 *  - `accounts_receivable.insuranceId` pasa a NULL.
 *  - CHECK XOR `ck_ar_debtor_xor`: exactamente uno de (insuranceId, holderId) presente.
 *  - Índice `idx_ar_holder`.
 *  - Migración de datos: filas de `credits_receivable` → `accounts_receivable`
 *    con nuevo `receivableNumber` desde `accounts_receivable_seq`. Pagos y
 *    links se vuelcan preservando los IDs (mapeo créditos→AR vía orderId, único en ambos lados).
 *  - Drop `credits_receivable_payment_links`, `credits_receivable_payments`,
 *    `credits_receivable` y la sequence `credits_receivable_seq`.
 */
export class IntegrateCreditsIntoAccountsReceivable1782004000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Schema ---
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD COLUMN IF NOT EXISTS "holderId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable"
         ADD CONSTRAINT "FK_accounts_receivable_holder"
         FOREIGN KEY ("holderId") REFERENCES "patients"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ar_holder" ON "accounts_receivable"("holderId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ALTER COLUMN "insuranceId" DROP NOT NULL`,
    );

    // --- Migración de datos credits_receivable → accounts_receivable ---
    // Sólo si existe la tabla (idempotente respecto a entornos limpios).
    const existsRows = (await queryRunner.query(
      `SELECT to_regclass('public.credits_receivable') IS NOT NULL AS exists`,
    )) as Array<{ exists: boolean }>;
    const exists = !!existsRows[0]?.exists;
    if (exists) {
      // 1. Volcar pagos preservando IDs (referenciados por los links).
      await queryRunner.query(`
        INSERT INTO "accounts_receivable_payments"
          ("id", "type", "paymentDate", "referenceNumber", "bankCode",
           "accountNumber", "exchangeRateId", "amountCurrency", "amountValue",
           "amountInBs", "createdAt", "updatedAt", "deletedAt")
        SELECT
          "id", "type", "paymentDate", "referenceNumber", "bankCode",
          "accountNumber", "exchangeRateId", "amountCurrency", "amountValue",
          "amountInBs", "createdAt", "updatedAt", "deletedAt"
        FROM "credits_receivable_payments"
        ON CONFLICT ("id") DO NOTHING
      `);

      // 2. Volcar créditos como cuentas por cobrar (holderId, insuranceId=NULL).
      //    Cada uno recibe un nuevo receivableNumber desde la sequence única.
      await queryRunner.query(`
        INSERT INTO "accounts_receivable"
          ("orderId", "receivableNumber", "insuranceId", "holderId",
           "status", "collectedAt", "createdAt", "updatedAt", "deletedAt")
        SELECT
          cr."orderId",
          nextval('accounts_receivable_seq')::text,
          NULL,
          cr."holderId",
          cr."status",
          cr."collectedAt",
          cr."createdAt",
          cr."updatedAt",
          cr."deletedAt"
        FROM "credits_receivable" cr
        WHERE NOT EXISTS (
          SELECT 1 FROM "accounts_receivable" ar WHERE ar."orderId" = cr."orderId"
        )
      `);

      // 3. Volcar links — mapeo crédito→AR vía orderId (UNIQUE en ambos).
      await queryRunner.query(`
        INSERT INTO "accounts_receivable_payment_links" ("receivableId", "paymentId")
        SELECT ar."id", crl."paymentId"
        FROM "credits_receivable_payment_links" crl
        JOIN "credits_receivable" cr ON cr."id" = crl."creditId"
        JOIN "accounts_receivable" ar ON ar."orderId" = cr."orderId" AND ar."holderId" IS NOT NULL
        ON CONFLICT DO NOTHING
      `);

      // 4. Drop tablas y sequence del módulo eliminado.
      await queryRunner.query(`DROP TABLE IF EXISTS "credits_receivable_payment_links"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "credits_receivable_payments"`);
      await queryRunner.query(`DROP TABLE IF EXISTS "credits_receivable"`);
      await queryRunner.query(`DROP SEQUENCE IF EXISTS credits_receivable_seq`);
    }

    // --- CHECK XOR (después de migrar datos para que las filas viejas pasen). ---
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ADD CONSTRAINT "ck_ar_debtor_xor" CHECK (
         ("insuranceId" IS NOT NULL AND "holderId" IS NULL)
         OR
         ("insuranceId" IS NULL AND "holderId" IS NOT NULL)
       )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaurar tablas/sequence credits_receivable.
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS credits_receivable_seq START 1`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credits_receivable" (
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
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cr_status" ON "credits_receivable"("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cr_holder" ON "credits_receivable"("holderId")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credits_receivable_payments" (
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
      CREATE TABLE IF NOT EXISTS "credits_receivable_payment_links" (
        "creditId" uuid NOT NULL REFERENCES "credits_receivable"("id") ON DELETE CASCADE,
        "paymentId" uuid NOT NULL REFERENCES "credits_receivable_payments"("id") ON DELETE CASCADE,
        PRIMARY KEY ("creditId", "paymentId")
      )
    `);

    // Restaurar filas: AR con holderId → credits_receivable.
    await queryRunner.query(`
      INSERT INTO "credits_receivable_payments"
        ("id", "type", "paymentDate", "referenceNumber", "bankCode",
         "accountNumber", "exchangeRateId", "amountCurrency", "amountValue",
         "amountInBs", "createdAt", "updatedAt", "deletedAt")
      SELECT DISTINCT
        arp."id", arp."type", arp."paymentDate", arp."referenceNumber", arp."bankCode",
        arp."accountNumber", arp."exchangeRateId", arp."amountCurrency", arp."amountValue",
        arp."amountInBs", arp."createdAt", arp."updatedAt", arp."deletedAt"
      FROM "accounts_receivable_payments" arp
      JOIN "accounts_receivable_payment_links" arl ON arl."paymentId" = arp."id"
      JOIN "accounts_receivable" ar ON ar."id" = arl."receivableId" AND ar."holderId" IS NOT NULL
      ON CONFLICT ("id") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "credits_receivable"
        ("orderId", "creditNumber", "holderId", "status", "collectedAt",
         "createdAt", "updatedAt", "deletedAt")
      SELECT
        ar."orderId",
        nextval('credits_receivable_seq')::text,
        ar."holderId",
        ar."status",
        ar."collectedAt",
        ar."createdAt",
        ar."updatedAt",
        ar."deletedAt"
      FROM "accounts_receivable" ar
      WHERE ar."holderId" IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "credits_receivable_payment_links" ("creditId", "paymentId")
      SELECT cr."id", arl."paymentId"
      FROM "accounts_receivable_payment_links" arl
      JOIN "accounts_receivable" ar ON ar."id" = arl."receivableId" AND ar."holderId" IS NOT NULL
      JOIN "credits_receivable" cr ON cr."orderId" = ar."orderId"
    `);

    // Quitar filas holder de accounts_receivable.
    await queryRunner.query(
      `DELETE FROM "accounts_receivable" WHERE "holderId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "ck_ar_debtor_xor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" ALTER COLUMN "insuranceId" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ar_holder"`);
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP CONSTRAINT IF EXISTS "FK_accounts_receivable_holder"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_receivable" DROP COLUMN IF EXISTS "holderId"`,
    );
  }
}
