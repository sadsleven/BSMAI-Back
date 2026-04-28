import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrderPaymentAccountNumber1782001800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'order_payments',
      new TableColumn({
        name: 'accountNumber',
        type: 'varchar',
        length: '40',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('order_payments', 'accountNumber');
  }
}
