import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Autorización de monto (Paso 1) por un usuario validador.
 *
 * Cuando el usuario que edita la orden no tiene `orders.edit-amount`, otro
 * usuario que sí lo tenga puede autorizar e ingresar un nuevo monto validando
 * sus credenciales. Se guarda quién autorizó, cuándo y la observación.
 */
export class AddOrderAmountAuthorization1782003600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "amountAuthorizedById" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "amountAuthorizedAt" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "amountAuthorizationNote" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_amount_authorized_by"
       FOREIGN KEY ("amountAuthorizedById") REFERENCES "users"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_orders_amount_authorized_by"
       ON "orders" ("amountAuthorizedById")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_orders_amount_authorized_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_amount_authorized_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "amountAuthorizationNote"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "amountAuthorizedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "amountAuthorizedById"`,
    );
  }
}
