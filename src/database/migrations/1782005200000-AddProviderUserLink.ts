import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vincula Doctor / CareCenter con una cuenta de usuario (acceso al sistema como
 * proveedor). `userId` nullable + FK ON DELETE SET NULL + índice unique parcial
 * (un user no puede mapear a dos proveedores; múltiples NULL permitidos).
 */
export class AddProviderUserLink1782005200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "doctors" ADD COLUMN "userId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD CONSTRAINT "fk_doctors_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_doctors_user"
      ON "doctors" ("userId") WHERE "userId" IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "care_centers" ADD COLUMN "userId" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "care_centers"
      ADD CONSTRAINT "fk_care_centers_user"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_care_centers_user"
      ON "care_centers" ("userId") WHERE "userId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_care_centers_user"`);
    await queryRunner.query(
      `ALTER TABLE "care_centers" DROP CONSTRAINT IF EXISTS "fk_care_centers_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "care_centers" DROP COLUMN IF EXISTS "userId"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_doctors_user"`);
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "fk_doctors_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "userId"`,
    );
  }
}
