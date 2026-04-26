import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPermissionI18n1777400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'permissions',
      new TableColumn({
        name: 'label',
        type: 'varchar',
        length: '120',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'permissions',
      new TableColumn({
        name: 'group',
        type: 'varchar',
        length: '60',
        isNullable: true,
      }),
    );
    // Backfill so columns can be made NOT NULL by the seed/runtime guarantees.
    await queryRunner.query(
      `UPDATE "permissions" SET "label" = COALESCE("description", "name") WHERE "label" IS NULL`,
    );
    await queryRunner.query(
      `UPDATE "permissions" SET "group" = INITCAP("resource") WHERE "group" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('permissions', 'group');
    await queryRunner.dropColumn('permissions', 'label');
  }
}
