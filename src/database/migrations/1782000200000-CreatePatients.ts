import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePatients1782000200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'patients',
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
          { name: 'birthDate', type: 'date' },
          { name: 'address', type: 'varchar', length: '500' },
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
        name: 'patient_phones',
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
          { name: 'patientId', type: 'uuid' },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'patient_phones',
      new TableForeignKey({
        columnNames: ['patientId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'patients',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'patient_phones',
      new TableIndex({
        name: 'IDX_patient_phones_patientId',
        columnNames: ['patientId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('patient_phones');
    await queryRunner.dropTable('patients');
  }
}
