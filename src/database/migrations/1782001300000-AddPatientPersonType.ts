import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Patient natural/legal_entity refactor.
 *
 * - Adds `personType` enum (default 'natural' for existing rows).
 * - Adds nullable `businessName` and `rif`.
 * - Drops the old strict UNIQUE constraint on `cedula` and makes `cedula`,
 *   `firstName`, `lastName` nullable.
 * - Creates partial unique indexes on `cedula` and `rif` (apply only when
 *   the column is not null), so naturals never collide with legal entities.
 */
export class AddPatientPersonType1782001300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN "personType" varchar(16) NOT NULL DEFAULT 'natural'`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN "businessName" varchar(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN "rif" varchar(24)`,
    );

    // Drop old strict UNIQUE on cedula (replaced by partial unique index).
    // Constraint name is auto-generated; query information_schema to drop it.
    const cedulaConstraints: { conname: string }[] = await queryRunner.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = '"patients"'::regclass
         AND contype = 'u'
         AND pg_get_constraintdef(oid) LIKE '%(cedula)%'`,
    );
    for (const c of cedulaConstraints) {
      await queryRunner.query(
        `ALTER TABLE "patients" DROP CONSTRAINT "${c.conname}"`,
      );
    }

    // Make natural-only fields nullable.
    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "cedula" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "firstName" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "lastName" DROP NOT NULL`);

    // Partial unique indexes — only enforce when column is not null.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_patients_cedula" ON "patients" ("cedula") WHERE "cedula" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_patients_rif" ON "patients" ("rif") WHERE "rif" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_patients_rif"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_patients_cedula"`);

    // Restore strict NOT NULL + UNIQUE on cedula. Down assumes no legal_entity rows exist.
    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "cedula" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "firstName" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "patients" ALTER COLUMN "lastName" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "UQ_patients_cedula" UNIQUE ("cedula")`,
    );

    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "rif"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "businessName"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "personType"`);
  }
}
