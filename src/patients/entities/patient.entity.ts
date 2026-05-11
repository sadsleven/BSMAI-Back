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
import { Contractor } from '../../contractors/entities/contractor.entity';

export type PersonType = 'natural' | 'legal_entity';
export const PERSON_TYPES: PersonType[] = ['natural', 'legal_entity'];

@Entity({ name: 'patients' })
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Discriminador. `natural` exige firstName/lastName/cedula. `legal_entity`
   * exige businessName/rif. Coherencia validada en DTO + service.
   */
  @Column({ type: 'varchar', length: 16, default: 'natural' })
  personType: PersonType;

  /** Cédula venezolana — sólo natural. Único parcial (WHERE cedula IS NOT NULL). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  cedula?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  firstName?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  lastName?: string | null;

  /** Razón social — sólo legal_entity. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  businessName?: string | null;

  /** RIF — sólo legal_entity. Único parcial (WHERE rif IS NOT NULL). */
  @Column({ type: 'varchar', length: 24, nullable: true })
  rif?: string | null;

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

  @ManyToMany(() => Contractor, (c) => c.patients, { eager: true })
  @JoinTable({
    name: 'patient_contractors',
    joinColumn: { name: 'patientId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'contractorId', referencedColumnName: 'id' },
  })
  contractors: Contractor[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
