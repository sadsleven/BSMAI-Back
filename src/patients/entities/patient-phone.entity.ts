import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';

@Entity({ name: 'patient_phones' })
export class PatientPhone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Exactamente 11 dígitos. Validado en DTO. */
  @Column({ type: 'varchar', length: 11 })
  number: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  label?: string | null;

  @ManyToOne(() => Patient, (p) => p.phones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid' })
  patientId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
