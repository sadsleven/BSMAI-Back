import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePatientContractors1782001000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'patient_contractors',
        columns: [
          { name: 'patientId', type: 'uuid', isPrimary: true },
          { name: 'contractorId', type: 'uuid', isPrimary: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'patient_contractors',
      new TableForeignKey({
        columnNames: ['patientId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'patients',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'patient_contractors',
      new TableForeignKey({
        columnNames: ['contractorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'contractors',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'patient_contractors',
      new TableIndex({
        name: 'IDX_patient_contractors_patientId',
        columnNames: ['patientId'],
      }),
    );
    await queryRunner.createIndex(
      'patient_contractors',
      new TableIndex({
        name: 'IDX_patient_contractors_contractorId',
        columnNames: ['contractorId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('patient_contractors');
  }
}
