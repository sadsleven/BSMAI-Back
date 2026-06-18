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
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import { AccountsPayablePayment } from './accounts-payable-payment.entity';
import { AccountsPayableOrder } from './accounts-payable-order.entity';

export type AccountsPayableStatus = 'paid' | 'unpaid' | 'partially_paid';
export type AccountsPayableRecipientType = 'doctor' | 'care_center';

/**
 * LOTE de Cuentas por pagar. Creado por el usuario para UN proveedor (doctor o
 * centro), agrupa N órdenes internas (`orders` → {@link AccountsPayableOrder}) y
 * acumula M pagos. Estado parcial/pagado según el neto a pagar (bruto −
 * retención SENIAT). Al quedar pagado nace 1 obligación de retención
 * (`taxes_payable.sourcePayableId`). El monto por proveedor vive en la orden
 * interna (`order_internal_orders.providerAmountUsd`), snapshoteado en el pivot.
 */
@Entity({ name: 'accounts_payable' })
@Index('idx_ap_status', ['status'])
@Index('idx_ap_doctor', ['doctorId'])
@Index('idx_ap_careCenter', ['careCenterId'])
export class AccountsPayable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  payableNumber: string;

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

  @Column({ type: 'varchar', length: 16, default: 'unpaid' })
  status: AccountsPayableStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  /** Órdenes internas incluidas en el lote (pivot con snapshot del bruto USD). */
  @OneToMany(() => AccountsPayableOrder, (o) => o.payable, { cascade: false })
  orders: AccountsPayableOrder[];

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

  // --- Transient (NO columnas). Calculados por el servicio al listar/ver. ---
  /** Suma de `grossUsd` del pivot (bruto USD del lote). */
  grossUsd?: number;
  /** Totaldel lote en Bs (Σ grossUsd × tasa de facturación por orden). */
  grossBs?: number;
  /** Retención SENIAT en Bs sobre el bruto del lote. */
  retentionBs?: number;
  /** Neto a entregar al proveedor en Bs (= bruto − retención). */
  netBs?: number;
  /** Pagado al proveedor en Bs (Σ pagos del lote). */
  paidBs?: number;
  /** Falta por pagar en Bs (= neto − pagado, ≥ 0). */
  pendingBs?: number;
}
