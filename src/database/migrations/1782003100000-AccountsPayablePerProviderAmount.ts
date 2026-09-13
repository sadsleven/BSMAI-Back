import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega `providerAmount` y `providerAmountCurrency` a `accounts_payable`.
 * Cada cuenta guarda lo que se paga a ese proveedor específico (no el total
 * de la orden). Permite que una misma orden tenga múltiples cuentas con
 * montos independientes.
 *
 * Backfill desde `orders.doctorAmount` / `orders.doctorAmountCurrency` (que
 * cuando esta migración corre todavía representan el total — y para órdenes
 * históricas con un único proveedor el total coincide con el monto al
 * proveedor). Tras la migración, `billing()` actualiza cada cuenta con su
 * monto correspondiente.
 */
export class AccountsPayablePerProviderAmount1782003100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "providerAmount" numeric(14,2) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD COLUMN IF NOT EXISTS "providerAmountCurrency" varchar(3) NULL`,
    );

    // Backfill: para cuentas existentes, asume single-provider — copia el doctorAmount de la orden.
    await queryRunner.query(`
      UPDATE "accounts_payable" ap
      SET "providerAmount" = o."doctorAmount",
          "providerAmountCurrency" = o."doctorAmountCurrency"
      FROM "orders" o
      WHERE ap."orderId" = o.id
        AND ap."providerAmount" IS NULL
        AND o."doctorAmount" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "providerAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" DROP COLUMN IF EXISTS "providerAmountCurrency"`,
    );
  }
}
