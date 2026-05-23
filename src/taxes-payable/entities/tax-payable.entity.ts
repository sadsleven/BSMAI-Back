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
import { AccountsPayable } from '../../accounts-payable/entities/accounts-payable.entity';
import { TaxPayablePayment } from './tax-payable-payment.entity';

export type TaxPayableStatus = 'paid' | 'unpaid' | 'partially_paid';
export type TaxPayableRecipientType = 'doctor' | 'care_center';

@Entity({ name: 'taxes_payable' })
@Index('idx_tp_status', ['status'])
@Index('idx_tp_doctor', ['doctorId'])
@Index('idx_tp_careCenter', ['careCenterId'])
@Index('idx_tp_order', ['orderId'])
export class TaxPayable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  taxPayableNumber: string;

  @Column({ type: 'uuid' })
  accountsPayableId: string;

  @ManyToOne(() => AccountsPayable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accountsPayableId' })
  accountsPayable: AccountsPayable;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'varchar', length: 16 })
  recipientType: TaxPayableRecipientType;

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
   * Monto del impuesto en moneda original (= providerAmount × taxRate).
   * Capturado al facturar (OrdersService.billing). Null mientras no se factura.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  taxAmount?: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  taxAmountCurrency?: 'USD' | 'EUR' | 'BS' | null;

  @Column({ type: 'numeric', precision: 5, scale: 4, nullable: true })
  taxRate?: string | null;

  @Column({ type: 'varchar', length: 16, default: 'unpaid' })
  status: TaxPayableStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  @ManyToMany(() => TaxPayablePayment, (p) => p.taxes, { cascade: false })
  @JoinTable({
    name: 'taxes_payable_payment_links',
    joinColumn: { name: 'taxPayableId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'paymentId', referencedColumnName: 'id' },
  })
  payments: TaxPayablePayment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
