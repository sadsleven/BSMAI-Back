import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Insurance: agrega columna `email` opcional con índice unique parcial.
 * - CareCenter: `email` y `rif` pasan a opcionales (drop NOT NULL + drop unique
 *   constraint → índice unique parcial `WHERE col IS NOT NULL`).
 */
export class AddInsuranceEmailAndCareCenterOptional1782002000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // insurances.email
    await queryRunner.query(
      `ALTER TABLE "insurances" ADD COLUMN IF NOT EXISTS "email" varchar(200)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_insurances_email_partial" ON "insurances"("email") WHERE "email" IS NOT NULL`,
    );

    // care_centers.email
    await queryRunner.query(
      `ALTER TABLE "care_centers" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        SELECT conname INTO c
        FROM pg_constraint
        WHERE conrelid = 'care_centers'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) LIKE '%(email)%';
        IF c IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "care_centers" DROP CONSTRAINT ' || quote_ident(c);
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_care_centers_email_partial" ON "care_centers"("email") WHERE "email" IS NOT NULL`,
    );

    // care_centers.rif
    await queryRunner.query(
      `ALTER TABLE "care_centers" ALTER COLUMN "rif" DROP NOT NULL`,
    );
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        SELECT conname INTO c
        FROM pg_constraint
        WHERE conrelid = 'care_centers'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) LIKE '%(rif)%';
        IF c IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "care_centers" DROP CONSTRAINT ' || quote_ident(c);
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_care_centers_rif_partial" ON "care_centers"("rif") WHERE "rif" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_care_centers_rif_partial"`,
    );
    await queryRunner.query(
      `ALTER TABLE "care_centers" ADD CONSTRAINT "UQ_care_centers_rif" UNIQUE ("rif")`,
    );
    await queryRunner.query(
      `ALTER TABLE "care_centers" ALTER COLUMN "rif" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_care_centers_email_partial"`,
    );
    await queryRunner.query(
      `ALTER TABLE "care_centers" ADD CONSTRAINT "UQ_care_centers_email" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "care_centers" ALTER COLUMN "email" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_insurances_email_partial"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insurances" DROP COLUMN IF EXISTS "email"`,
    );
  }
}
