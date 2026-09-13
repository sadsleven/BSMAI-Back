import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRoleIsSystem1777300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'roles',
      new TableColumn({
        name: 'isSystem',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
    await queryRunner.query(
      `UPDATE "roles" SET "isSystem" = true WHERE "name" = 'Super Admin'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('roles', 'isSystem');
  }
}
