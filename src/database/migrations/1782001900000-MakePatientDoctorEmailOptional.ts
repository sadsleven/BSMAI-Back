import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Email opcional para Patient y Doctor.
 * - Drop NOT NULL.
 * - Drop unique constraint creado al crear la tabla.
 * - Reemplaza por índice unique parcial (`WHERE email IS NOT NULL`),
 *   coherente con la convención del proyecto para `cedula` / `rif`.
 */
export class MakePatientDoctorEmailOptional1782001900000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // patients
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        SELECT conname INTO c
        FROM pg_constraint
        WHERE conrelid = 'patients'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) LIKE '%(email)%';
        IF c IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "patients" DROP CONSTRAINT ' || quote_ident(c);
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_patients_email_partial" ON "patients"("email") WHERE "email" IS NOT NULL`,
    );

    // doctors
    await queryRunner.query(
      `ALTER TABLE "doctors" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(`
      DO $$
      DECLARE c text;
      BEGIN
        SELECT conname INTO c
        FROM pg_constraint
        WHERE conrelid = 'doctors'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) LIKE '%(email)%';
        IF c IS NOT NULL THEN
          EXECUTE 'ALTER TABLE "doctors" DROP CONSTRAINT ' || quote_ident(c);
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_doctors_email_partial" ON "doctors"("email") WHERE "email" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_doctors_email_partial"`);
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD CONSTRAINT "UQ_doctors_email" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" ALTER COLUMN "email" SET NOT NULL`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_patients_email_partial"`);
    await queryRunner.query(
      `ALTER TABLE "patients" ADD CONSTRAINT "UQ_patients_email" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "patients" ALTER COLUMN "email" SET NOT NULL`,
    );
  }
}
