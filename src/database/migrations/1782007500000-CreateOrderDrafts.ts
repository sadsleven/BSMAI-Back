import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `order_drafts`: borradores PARCIALES del Paso 1 de una orden. Guardan el
 * payload crudo del formulario (jsonb, sin validar) para retomar la creación
 * sin recargar todo. Personal: scope por `userId` (CASCADE al borrar el user).
 * Se materializan en una `Order` real al completar el Paso 1 y luego se borran.
 */
export class CreateOrderDrafts1782007500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_drafts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "branchId" uuid,
        "label" varchar(200),
        "payload" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_order_drafts" PRIMARY KEY ("id"),
        CONSTRAINT "fk_order_drafts_user" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_order_drafts_user" ON "order_drafts" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_drafts_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_drafts"`);
  }
}
