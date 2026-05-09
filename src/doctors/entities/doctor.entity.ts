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
import { Specialty } from '../../specialties/entities/specialty.entity';
import { DoctorPhone } from './doctor-phone.entity';
import { DoctorPaymentMethod } from './doctor-payment-method.entity';

@Entity({ name: 'doctors' })
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  cedula: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 150 })
  firstName: string;

  @Column({ type: 'varchar', length: 150 })
  lastName: string;

  @Column({ type: 'boolean', default: false })
  isLegalEntity: boolean;

  /** Sólo presente cuando isLegalEntity === true. */
  @Column({ type: 'varchar', length: 24, nullable: true, unique: true })
  rif?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => Specialty, { eager: true })
  @JoinTable({
    name: 'doctors_specialties',
    joinColumn: { name: 'doctorId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'specialtyId', referencedColumnName: 'id' },
  })
  specialties: Specialty[];

  @OneToMany(() => DoctorPhone, (phone) => phone.doctor, {
    cascade: true,
    eager: true,
  })
  phones: DoctorPhone[];

  @OneToMany(() => DoctorPaymentMethod, (m) => m.doctor, {
    cascade: true,
    eager: true,
  })
  paymentMethods: DoctorPaymentMethod[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
