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
import { TaxUnit } from '../../tax-units/entities/tax-unit.entity';
import { TaxPayablePayment } from './tax-payable-payment.entity';

export type TaxPayableStatus = 'paid' | 'unpaid' | 'partially_paid';
export type TaxPayableRecipientType = 'doctor' | 'care_center';
export type TaxPayablePersonType = 'natural' | 'legal_entity';

@Entity({ name: 'taxes_payable' })
@Index('idx_tp_status', ['status'])
@Index('idx_tp_doctor', ['doctorId'])
@Index('idx_tp_careCenter', ['careCenterId'])
@Index('idx_tp_taxUnit', ['taxUnitId'])
export class TaxPayable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  taxPayableNumber: string;

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

  /** Régimen fiscal aplicado al cálculo SENIAT (Decreto 1.808). */
  @Column({ type: 'varchar', length: 16 })
  personType: TaxPayablePersonType;

  @Column({ type: 'uuid' })
  taxUnitId: string;

  @ManyToOne(() => TaxUnit, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'taxUnitId' })
  taxUnit: TaxUnit;

  /** Snapshot del valor de la UT (Bs) usada para el cálculo. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  taxUnitAmountBs: string;

  /** Monto bruto del pago al proveedor en Bs (base imponible). */
  @Column({ type: 'numeric', precision: 18, scale: 2 })
  grossAmountBs: string;

  /** Tasa aplicada (0.03 PNR o 0.05 PJD). */
  @Column({ type: 'numeric', precision: 5, scale: 4 })
  taxRate: string;

  /** Sustraendo en Bs (sólo PNR; 0 para PJD). */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtrahendBs: string;

  /** Retención calculada en Bs (≥ 0). */
  @Column({ type: 'numeric', precision: 18, scale: 2 })
  taxAmountBs: string;

  @Column({ type: 'varchar', length: 16, default: 'unpaid' })
  status: TaxPayableStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  /** Órdenes contenidas en la factura agrupada del pago al proveedor. */
  @ManyToMany(() => Order, { cascade: false })
  @JoinTable({
    name: 'taxes_payable_orders',
    joinColumn: { name: 'taxPayableId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'orderId', referencedColumnName: 'id' },
  })
  orders: Order[];

  /** Cuentas por pagar cubiertas por el pago al proveedor que originó esta retención. */
  @ManyToMany(() => AccountsPayable, { cascade: false })
  @JoinTable({
    name: 'taxes_payable_payables',
    joinColumn: { name: 'taxPayableId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'payableId', referencedColumnName: 'id' },
  })
  accountsPayables: AccountsPayable[];

  /** Pagos al fisco aplicados sobre esta retención. */
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
