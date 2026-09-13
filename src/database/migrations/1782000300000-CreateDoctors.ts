import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDoctors1782000300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'doctors',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'cedula', type: 'varchar', length: '16', isUnique: true },
          { name: 'email', type: 'varchar', length: '200', isUnique: true },
          { name: 'firstName', type: 'varchar', length: '150' },
          { name: 'lastName', type: 'varchar', length: '150' },
          { name: 'isLegalEntity', type: 'boolean', default: false },
          {
            name: 'rif',
            type: 'varchar',
            length: '24',
            isNullable: true,
            isUnique: true,
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
        name: 'doctor_phones',
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
          { name: 'doctorId', type: 'uuid' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'doctor_phones',
      new TableForeignKey({
        columnNames: ['doctorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'doctors',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'doctor_phones',
      new TableIndex({
        name: 'IDX_doctor_phones_doctorId',
        columnNames: ['doctorId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'doctor_payment_methods',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'doctorId', type: 'uuid' },
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
      'doctor_payment_methods',
      new TableForeignKey({
        columnNames: ['doctorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'doctors',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'doctor_payment_methods',
      new TableIndex({
        name: 'IDX_doctor_payment_methods_doctorId',
        columnNames: ['doctorId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'doctors_specialties',
        columns: [
          { name: 'doctorId', type: 'uuid', isPrimary: true },
          { name: 'specialtyId', type: 'uuid', isPrimary: true },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'doctors_specialties',
      new TableForeignKey({
        columnNames: ['doctorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'doctors',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'doctors_specialties',
      new TableForeignKey({
        columnNames: ['specialtyId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'specialties',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('doctors_specialties');
    await queryRunner.dropTable('doctor_payment_methods');
    await queryRunner.dropTable('doctor_phones');
    await queryRunner.dropTable('doctors');
  }
}
