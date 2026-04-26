import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateAuthSystem1777149187269 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'name', type: 'varchar', length: '120', isUnique: true },
          { name: 'resource', type: 'varchar', length: '60' },
          { name: 'action', type: 'varchar', length: '60' },
          { name: 'description', type: 'varchar', length: '255', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'name', type: 'varchar', length: '80', isUnique: true },
          { name: 'description', type: 'varchar', length: '255', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'firstName', type: 'varchar', length: '120' },
          { name: 'lastName', type: 'varchar', length: '120' },
          { name: 'email', type: 'varchar', length: '180', isUnique: true },
          { name: 'phoneNumber', type: 'varchar', length: '40', isNullable: true },
          { name: 'password', type: 'varchar', length: '255' },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'isSuperAdmin', type: 'boolean', default: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'roles_permissions',
        columns: [
          { name: 'roleId', type: 'uuid' },
          { name: 'permissionId', type: 'uuid' },
        ],
      }),
      true,
    );
    await queryRunner.createPrimaryKey('roles_permissions', ['roleId', 'permissionId']);
    await queryRunner.createForeignKey(
      'roles_permissions',
      new TableForeignKey({
        columnNames: ['roleId'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'roles_permissions',
      new TableForeignKey({
        columnNames: ['permissionId'],
        referencedTableName: 'permissions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'roles_permissions',
      new TableIndex({ name: 'IDX_roles_permissions_role', columnNames: ['roleId'] }),
    );
    await queryRunner.createIndex(
      'roles_permissions',
      new TableIndex({ name: 'IDX_roles_permissions_permission', columnNames: ['permissionId'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'users_roles',
        columns: [
          { name: 'userId', type: 'uuid' },
          { name: 'roleId', type: 'uuid' },
        ],
      }),
      true,
    );
    await queryRunner.createPrimaryKey('users_roles', ['userId', 'roleId']);
    await queryRunner.createForeignKey(
      'users_roles',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'users_roles',
      new TableForeignKey({
        columnNames: ['roleId'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'users_roles',
      new TableIndex({ name: 'IDX_users_roles_user', columnNames: ['userId'] }),
    );
    await queryRunner.createIndex(
      'users_roles',
      new TableIndex({ name: 'IDX_users_roles_role', columnNames: ['roleId'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users_roles', true);
    await queryRunner.dropTable('roles_permissions', true);
    await queryRunner.dropTable('users', true);
    await queryRunner.dropTable('roles', true);
    await queryRunner.dropTable('permissions', true);
  }
}
