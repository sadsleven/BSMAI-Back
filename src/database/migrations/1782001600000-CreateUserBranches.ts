import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateUserBranches1782001600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_branches',
        columns: [
          { name: 'userId', type: 'uuid', isPrimary: true },
          { name: 'branchId', type: 'uuid', isPrimary: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'user_branches',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'user_branches',
      new TableForeignKey({
        columnNames: ['branchId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'branches',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'user_branches',
      new TableIndex({
        name: 'IDX_user_branches_userId',
        columnNames: ['userId'],
      }),
    );
    await queryRunner.createIndex(
      'user_branches',
      new TableIndex({
        name: 'IDX_user_branches_branchId',
        columnNames: ['branchId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_branches');
  }
}
