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
import { CareCenter } from './care-center.entity';

export type CareCenterPaymentMethodType =
  | 'mobile_payment'
  | 'bank_transfer'
  | 'other';

@Entity({ name: 'care_center_payment_methods' })
export class CareCenterPaymentMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CareCenter, (c) => c.paymentMethods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'careCenterId' })
  careCenter: CareCenter;

  @Column({ type: 'uuid' })
  careCenterId: string;

  @Column({ type: 'varchar', length: 24 })
  type: CareCenterPaymentMethodType;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 8, nullable: true })
  bankCode?: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  phoneNumber?: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  idDocument?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  accountNumber?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  accountHolderName?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
