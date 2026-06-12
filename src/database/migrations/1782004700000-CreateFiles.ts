import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFiles1782004700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "files" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "storageProvider" varchar(32) NOT NULL DEFAULT 'vercel_blob',
        "pathname" text NOT NULL,
        "url" text NOT NULL,
        "name" varchar(500) NOT NULL,
        "mimeType" varchar(200) NOT NULL,
        "sizeBytes" bigint NOT NULL,
        "ownerType" varchar(32) NOT NULL,
        "ownerId" uuid NOT NULL,
        "kind" varchar(64),
        "uploadedById" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "deletedAt" timestamptz,
        CONSTRAINT "fk_files_uploaded_by"
          FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_files_owner" ON "files" ("ownerType", "ownerId")
      WHERE "deletedAt" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_files_uploaded_by" ON "files" ("uploadedById")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_files_uploaded_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_files_owner"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "files"`);
  }
}
