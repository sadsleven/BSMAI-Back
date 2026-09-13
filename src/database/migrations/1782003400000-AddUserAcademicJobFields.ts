import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * User.academicDegree + User.jobTitle — campos opcionales.
 * - academicDegree varchar(40): título académico (lista controlada en FE,
 *   sin enum DB; el BE valida sólo longitud).
 * - jobTitle varchar(100): cargo libre.
 */
export class AddUserAcademicJobFields1782003400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "academicDegree" varchar(40) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jobTitle" varchar(100) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "jobTitle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "academicDegree"`,
    );
  }
}
