import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateOrders1782001700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SEQUENCE IF NOT EXISTS orders_seq START 1');

    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'orderNumber',
            type: 'varchar',
            length: '32',
            isUnique: true,
          },
          { name: 'branchId', type: 'uuid' },
          { name: 'type', type: 'varchar', length: '16' },
          { name: 'status', type: 'varchar', length: '24', default: "'draft'" },
          { name: 'holderId', type: 'uuid' },
          { name: 'patientId', type: 'uuid' },
          { name: 'contractorId', type: 'uuid', isNullable: true },
          { name: 'insuranceId', type: 'uuid', isNullable: true },
          { name: 'providerType', type: 'varchar', length: '16' },
          { name: 'doctorId', type: 'uuid', isNullable: true },
          { name: 'careCenterId', type: 'uuid', isNullable: true },
          { name: 'specialtyId', type: 'uuid' },
          { name: 'serviceTypeId', type: 'uuid' },
          { name: 'pathologyId', type: 'uuid' },
          { name: 'orderDate', type: 'date' },
          { name: 'appointmentDate', type: 'timestamptz' },
          { name: 'priceCurrency', type: 'varchar', length: '3' },
          { name: 'priceAmount', type: 'numeric', precision: 14, scale: 2 },
          { name: 'createdById', type: 'uuid' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    const fks: Array<{ col: string; ref: string; refCol?: string }> = [
      { col: 'branchId', ref: 'branches' },
      { col: 'holderId', ref: 'patients' },
      { col: 'patientId', ref: 'patients' },
      { col: 'contractorId', ref: 'contractors' },
      { col: 'insuranceId', ref: 'insurances' },
      { col: 'doctorId', ref: 'doctors' },
      { col: 'careCenterId', ref: 'care_centers' },
      { col: 'specialtyId', ref: 'specialties' },
      { col: 'serviceTypeId', ref: 'service_types' },
      { col: 'pathologyId', ref: 'pathologies' },
      { col: 'createdById', ref: 'users' },
    ];

    for (const fk of fks) {
      await queryRunner.createForeignKey(
        'orders',
        new TableForeignKey({
          columnNames: [fk.col],
          referencedColumnNames: [fk.refCol ?? 'id'],
          referencedTableName: fk.ref,
          onDelete: 'RESTRICT',
        }),
      );
    }

    await queryRunner.createIndices('orders', [
      new TableIndex({ name: 'idx_orders_branch', columnNames: ['branchId'] }),
      new TableIndex({ name: 'idx_orders_holder', columnNames: ['holderId'] }),
      new TableIndex({
        name: 'idx_orders_patient',
        columnNames: ['patientId'],
      }),
      new TableIndex({ name: 'idx_orders_status', columnNames: ['status'] }),
      new TableIndex({
        name: 'idx_orders_orderDate',
        columnNames: ['orderDate'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'order_payments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'orderId', type: 'uuid' },
          { name: 'type', type: 'varchar', length: '24' },
          { name: 'paymentDate', type: 'date' },
          {
            name: 'referenceNumber',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          { name: 'bankCode', type: 'varchar', length: '8', isNullable: true },
          { name: 'exchangeRateId', type: 'uuid', isNullable: true },
          { name: 'amountCurrency', type: 'varchar', length: '3' },
          { name: 'amountValue', type: 'numeric', precision: 14, scale: 2 },
          { name: 'amountInBs', type: 'numeric', precision: 18, scale: 2 },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
          { name: 'deletedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'order_payments',
      new TableForeignKey({
        columnNames: ['orderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'order_payments',
      new TableForeignKey({
        columnNames: ['exchangeRateId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'exchange_rates',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createIndex(
      'order_payments',
      new TableIndex({
        name: 'idx_order_payments_order',
        columnNames: ['orderId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_payments');
    await queryRunner.dropTable('orders');
    await queryRunner.query('DROP SEQUENCE IF EXISTS orders_seq');
  }
}
