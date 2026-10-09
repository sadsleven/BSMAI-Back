import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import { TaxUnit } from '../../tax-units/entities/tax-unit.entity';
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';
import { AccountsPayableSettlement } from './accounts-payable-settlement.entity';
import { AccountsPayableOrder } from './accounts-payable-order.entity';

export type AccountsPayableStatus = 'paid' | 'unpaid' | 'partially_paid';
export type AccountsPayableRecipientType = 'doctor' | 'care_center';

/**
 * LOTE de Cuentas por pagar. Creado por el usuario para UN proveedor (doctor o
 * centro), agrupa N órdenes internas (`orders` → {@link AccountsPayableOrder}) y
 * se liquida con M ABONOS (`settlements` → {@link AccountsPayableSettlement}).
 *
 * El saldo del lote se lleva en USD: cada abono cubre una porción del bruto USD
 * a SU tasa y con SU retención, de modo que pagar en dos partes a tasas
 * distintas no recalcula lo ya pagado. Estado parcial/pagado según los USD
 * cubiertos. Cada abono genera su propia obligación con el SENIAT
 * (`taxes_payable.sourceSettlementId`). El monto por proveedor vive en la orden
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

  /**
   * UT elegida para el cálculo de la retención SENIAT del lote.
   * NULL = usar la UT vigente al momento del cálculo (lotes previos).
   */
  @Column({ type: 'uuid', nullable: true })
  taxUnitId?: string | null;

  @ManyToOne(() => TaxUnit, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'taxUnitId' })
  taxUnit?: TaxUnit | null;

  /**
   * ¿El lote descuenta la retención de ISLR (SENIAT)? `false` ⇒ neto = bruto y
   * al quedar pagado NO nace la obligación en `taxes_payable`. Default `true`.
   */
  @Column({ type: 'boolean', default: true })
  applyRetention: boolean;

  /**
   * Tasa de pago USD/Bs POR DEFECTO del lote: la que se propone a cada abono
   * nuevo y con la que se proyecta en Bs el saldo aún no pagado. No afecta a
   * los abonos ya registrados (cada uno snapshotea la suya). NULL = tasa de
   * facturación de cada orden (lotes previos a la columna).
   */
  @Column({ type: 'uuid', nullable: true })
  exchangeRateId?: string | null;

  @ManyToOne(() => ExchangeRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'exchangeRateId' })
  exchangeRate?: ExchangeRate | null;

  @Column({ type: 'varchar', length: 16, default: 'unpaid' })
  status: AccountsPayableStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  /** Órdenes internas incluidas en el lote (pivot con snapshot del bruto USD). */
  @OneToMany(() => AccountsPayableOrder, (o) => o.payable, { cascade: false })
  orders: AccountsPayableOrder[];

  /** Abonos del lote (cada uno con su tasa, su retención y sus filas de pago). */
  @OneToMany(() => AccountsPayableSettlement, (s) => s.payable, {
    cascade: false,
  })
  settlements: AccountsPayableSettlement[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  // --- Transient (NO columnas). Calculados por el servicio al listar/ver. ---
  /**
   * Nº de órdenes internas del lote. En el listado llega agregado por SQL (el
   * pivot no se hidrata); en el detalle es `orders.length`.
   */
  orderCount?: number;
  /** Suma de `grossUsd` del pivot (bruto USD del lote). */
  grossUsd?: number;
  /** Nº de abonos registrados. */
  settlementCount?: number;
  /** USD del bruto ya cubiertos por abonos (Σ `coveredUsd`). */
  coveredUsd?: number;
  /** USD del bruto que faltan por pagar (= grossUsd − coveredUsd, ≥ 0): el saldo real. */
  pendingUsd?: number;
  /** Bruto en Bs de los abonos registrados (Σ `grossBs`, a la tasa de cada uno). */
  settledGrossBs?: number;
  /** Retención en Bs ya practicada (Σ `retentionBs` de los abonos). */
  settledRetentionBs?: number;
  /**
   * Total del lote en Bs: lo abonado a la tasa de cada abono + el saldo
   * pendiente proyectado a la tasa por defecto del lote.
   */
  grossBs?: number;
  /** Retención SENIAT en Bs: la practicada + la proyectada sobre el saldo. */
  retentionBs?: number;
  /** Neto al proveedor en Bs (= bruto − retención), con el saldo proyectado. */
  netBs?: number;
  /** Entregado al proveedor en Bs (Σ `netBs` de los abonos). */
  paidBs?: number;
  /** Neto proyectado del saldo pendiente en Bs (= netBs − paidBs, ≥ 0). */
  pendingBs?: number;
}
