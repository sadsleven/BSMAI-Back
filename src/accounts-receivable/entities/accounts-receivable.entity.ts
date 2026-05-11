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
import { Insurance } from '../../insurances/entities/insurance.entity';
import { AccountsReceivablePayment } from './accounts-receivable-payment.entity';

export type AccountsReceivableStatus =
  | 'collected'
  | 'uncollected'
  | 'partially_collected'
  | 'overcollected';

@Entity({ name: 'accounts_receivable' })
@Index('idx_ar_status', ['status'])
@Index('idx_ar_insurance', ['insuranceId'])
export class AccountsReceivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  receivableNumber: string;

  @Column({ type: 'uuid', unique: true })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  insuranceId: string;

  @ManyToOne(() => Insurance, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'insuranceId' })
  insurance: Insurance;

  @Column({ type: 'varchar', length: 16, default: 'uncollected' })
  status: AccountsReceivableStatus;

  @Column({ type: 'timestamptz', nullable: true })
  collectedAt?: Date | null;

  @ManyToMany(() => AccountsReceivablePayment, (p) => p.accounts, { cascade: false })
  @JoinTable({
    name: 'accounts_receivable_payment_links',
    joinColumn: { name: 'receivableId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'paymentId', referencedColumnName: 'id' },
  })
  payments: AccountsReceivablePayment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
