import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';

export type DoctorPaymentMethodType =
  | 'mobile_payment'
  | 'bank_transfer'
  | 'other';

@Entity({ name: 'doctor_payment_methods' })
export class DoctorPaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, (d) => d.paymentMethods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid' })
  doctorId: string;

  @Column({ type: 'varchar', length: 24 })
  type: DoctorPaymentMethodType;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // mobile_payment
  @Column({ type: 'varchar', length: 8, nullable: true })
  bankCode?: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  phoneNumber?: string | null;

  // mobile_payment + bank_transfer
  @Column({ type: 'varchar', length: 24, nullable: true })
  idDocument?: string | null;

  // bank_transfer
  @Column({ type: 'varchar', length: 20, nullable: true })
  accountNumber?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  accountHolderName?: string | null;

  // other
  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
