import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateExchangeRates1782001100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'exchange_rates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'currency', type: 'varchar', length: '3' },
          { name: 'amountBs', type: 'numeric', precision: 14, scale: 2 },
          { name: 'effectiveDate', type: 'date' },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'exchange_rates',
      new TableIndex({
        name: 'idx_exchange_rates_currency_effective_date',
        columnNames: ['currency', 'effectiveDate'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('exchange_rates');
  }
}
