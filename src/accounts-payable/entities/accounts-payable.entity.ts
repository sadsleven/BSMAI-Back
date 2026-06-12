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
import { Doctor } from '../../doctors/entities/doctor.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import { AccountsPayablePayment } from './accounts-payable-payment.entity';

export type AccountsPayableStatus = 'paid' | 'unpaid' | 'partially_paid';
export type AccountsPayableRecipientType = 'doctor' | 'care_center';

@Entity({ name: 'accounts_payable' })
@Index('idx_ap_status', ['status'])
@Index('idx_ap_doctor', ['doctorId'])
@Index('idx_ap_careCenter', ['careCenterId'])
export class AccountsPayable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  payableNumber: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'varchar', length: 16 })
  recipientType: AccountsPayableRecipientType;

  @Column({ type: 'uuid', nullable: true })
  doctorId?: string | null;

  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'doctorId' })
  doctor?: Doctor | null;

  @Column({ type: 'uuid', nullable: true })
  careCenterId?: string | null;

  @ManyToOne(() => CareCenter, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'careCenterId' })
  careCenter?: CareCenter | null;

  /**
   * Monto a pagar a este proveedor específico, en USD. Se popula durante el
   * Paso 4 (`OrdersService.billing`) con el valor de `BillingProviderDto.amount`.
   * `null` mientras la orden aún no se factura.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  providerAmount?: string | null;

  @Column({ type: 'varchar', length: 16, default: 'unpaid' })
  status: AccountsPayableStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @ManyToMany(() => AccountsPayablePayment, (p) => p.accounts, { cascade: false })
  @JoinTable({
    name: 'accounts_payable_payment_links',
    joinColumn: { name: 'payableId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'paymentId', referencedColumnName: 'id' },
  })
  payments: AccountsPayablePayment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
