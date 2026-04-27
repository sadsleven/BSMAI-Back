import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PatientPhone } from './patient-phone.entity';
import { Insurance } from '../../insurances/entities/insurance.entity';

@Entity({ name: 'patients' })
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Cédula venezolana formato `V-XX.XXX.XXX` o `E-XX.XXX.XXX`. Único. */
  @Column({ type: 'varchar', length: 16, unique: true })
  cedula: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 150 })
  firstName: string;

  @Column({ type: 'varchar', length: 150 })
  lastName: string;

  @Column({ type: 'date' })
  birthDate: string;

  @Column({ type: 'varchar', length: 500 })
  address: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => PatientPhone, (phone) => phone.patient, {
    cascade: true,
    eager: true,
  })
  phones: PatientPhone[];

  @ManyToMany(() => Insurance, (i) => i.patients, { eager: true })
  @JoinTable({
    name: 'patient_insurances',
    joinColumn: { name: 'patientId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'insuranceId', referencedColumnName: 'id' },
  })
  insurances: Insurance[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
