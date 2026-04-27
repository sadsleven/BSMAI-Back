import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePatientInsurances1782000800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'patient_insurances',
        columns: [
          { name: 'patientId', type: 'uuid', isPrimary: true },
          { name: 'insuranceId', type: 'uuid', isPrimary: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'patient_insurances',
      new TableForeignKey({
        columnNames: ['patientId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'patients',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'patient_insurances',
      new TableForeignKey({
        columnNames: ['insuranceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'insurances',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'patient_insurances',
      new TableIndex({
        name: 'IDX_patient_insurances_patientId',
        columnNames: ['patientId'],
      }),
    );
    await queryRunner.createIndex(
      'patient_insurances',
      new TableIndex({
        name: 'IDX_patient_insurances_insuranceId',
        columnNames: ['insuranceId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('patient_insurances');
  }
}
