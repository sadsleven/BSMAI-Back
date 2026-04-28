import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameCareCenterNameToBusinessName1782001200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "care_centers" RENAME COLUMN "name" TO "businessName"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "care_centers" RENAME COLUMN "businessName" TO "name"`,
    );
  }
}
