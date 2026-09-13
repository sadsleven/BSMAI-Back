import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateInsurances1782000700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'insurances',
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
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
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
        name: 'insurance_phones',
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
          { name: 'insuranceId', type: 'uuid' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'insurance_phones',
      new TableForeignKey({
        columnNames: ['insuranceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'insurances',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'insurance_phones',
      new TableIndex({
        name: 'IDX_insurance_phones_insuranceId',
        columnNames: ['insuranceId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('insurance_phones');
    await queryRunner.dropTable('insurances');
  }
}
