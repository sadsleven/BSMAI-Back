import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCareCenters1782000400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'care_centers',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'name', type: 'varchar', length: '200', isUnique: true },
          { name: 'email', type: 'varchar', length: '200', isUnique: true },
          { name: 'rif', type: 'varchar', length: '24', isUnique: true },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'care_center_phones',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'number', type: 'varchar', length: '11' },
          { name: 'label', type: 'varchar', length: '80', isNullable: true },
          { name: 'careCenterId', type: 'uuid' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'care_center_phones',
      new TableForeignKey({
        columnNames: ['careCenterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'care_centers',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'care_center_phones',
      new TableIndex({
        name: 'IDX_care_center_phones_careCenterId',
        columnNames: ['careCenterId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'care_center_payment_methods',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'careCenterId', type: 'uuid' },
          { name: 'type', type: 'varchar', length: '24' },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'bankCode', type: 'varchar', length: '8', isNullable: true },
          {
            name: 'phoneNumber',
            type: 'varchar',
            length: '11',
            isNullable: true,
          },
          {
            name: 'idDocument',
            type: 'varchar',
            length: '24',
            isNullable: true,
          },
          {
            name: 'accountNumber',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'accountHolderName',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'care_center_payment_methods',
      new TableForeignKey({
        columnNames: ['careCenterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'care_centers',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'care_center_payment_methods',
      new TableIndex({
        name: 'IDX_care_center_payment_methods_careCenterId',
        columnNames: ['careCenterId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'care_centers_specialties',
        columns: [
          { name: 'careCenterId', type: 'uuid', isPrimary: true },
          { name: 'specialtyId', type: 'uuid', isPrimary: true },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'care_centers_specialties',
      new TableForeignKey({
        columnNames: ['careCenterId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'care_centers',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'care_centers_specialties',
      new TableForeignKey({
        columnNames: ['specialtyId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'specialties',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('care_centers_specialties');
    await queryRunner.dropTable('care_center_payment_methods');
    await queryRunner.dropTable('care_center_phones');
    await queryRunner.dropTable('care_centers');
  }
}
