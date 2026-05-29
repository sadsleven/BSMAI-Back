import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { CreditsReceivablePayment } from './credits-receivable-payment.entity';

export type CreditsReceivableStatus =
  | 'collected'
  | 'uncollected'
  | 'partially_collected'
  | 'overcollected';

@Entity({ name: 'credits_receivable' })
@Index('idx_cr_status', ['status'])
@Index('idx_cr_holder', ['holderId'])
export class CreditsReceivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  creditNumber: string;

  @Column({ type: 'uuid', unique: true })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  holderId: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'holderId' })
  holder: Patient;

  @Column({ type: 'varchar', length: 20, default: 'uncollected' })
  status: CreditsReceivableStatus;

  @Column({ type: 'timestamptz', nullable: true })
  collectedAt?: Date | null;

  @ManyToMany(() => CreditsReceivablePayment, (p) => p.credits, { cascade: false })
  @JoinTable({
    name: 'credits_receivable_payment_links',
    joinColumn: { name: 'creditId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'paymentId', referencedColumnName: 'id' },
  })
  payments: CreditsReceivablePayment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
