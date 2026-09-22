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
import { Insurance } from '../../insurances/entities/insurance.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { AccountsReceivablePayment } from './accounts-receivable-payment.entity';
import { AccountsReceivableOrder } from './accounts-receivable-order.entity';

export type AccountsReceivableStatus =
  | 'collected'
  | 'uncollected'
  | 'partially_collected'
  | 'overcollected';

/**
 * Tipo de deudor: seguro (orden type='insurance'), titular (type='credit') o
 * Cashea (type='cashea', la fintech paga — el lote puede mezclar titulares).
 */
export type AccountsReceivableDebtorType = 'insurance' | 'holder' | 'cashea';

/**
 * LOTE de Cuentas por cobrar. Creado por el usuario para UN deudor (seguro,
 * titular o Cashea), agrupa N órdenes (`orders` → {@link AccountsReceivableOrder})
 * y acumula M cobros. El target/modo (Bs tasa fija vs USD) se snapshotea por
 * orden en el pivot. Sin tope: puede quedar `overcollected`.
 * Deudor Cashea = `insuranceId` y `holderId` ambos NULL.
 */
@Entity({ name: 'accounts_receivable' })
@Index('idx_ar_status', ['status'])
@Index('idx_ar_insurance', ['insuranceId'])
@Index('idx_ar_holder', ['holderId'])
export class AccountsReceivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  receivableNumber: string;

  /** Seguro deudor. Excluyente con `holderId` (CHECK ck_ar_debtor_xor). Ambos NULL = Cashea. */
  @Column({ type: 'uuid', nullable: true })
  insuranceId?: string | null;

  @ManyToOne(() => Insurance, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'insuranceId' })
  insurance?: Insurance | null;

  /** Titular deudor (paciente). Excluyente con `insuranceId`. */
  @Column({ type: 'uuid', nullable: true })
  holderId?: string | null;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'holderId' })
  holder?: Patient | null;

  @Column({ type: 'varchar', length: 32, default: 'uncollected' })
  status: AccountsReceivableStatus;

  @Column({ type: 'timestamptz', nullable: true })
  collectedAt?: Date | null;

  /**
   * Ajuste firmado sobre el total a cobrar, en la MONEDA DEL LOTE (Bs si
   * `mode='fixed'`, USD si `mode='usd'`). Negativo = resta (el seguro paga
   * menos de lo facturado), positivo = suma. NULL/0 = sin ajuste.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  adjustmentAmount?: string | null;

  /** Motivo del ajuste. Obligatorio cuando `adjustmentAmount` ≠ 0. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  adjustmentNote?: string | null;

  /** Usuario que aplicó el ajuste vigente. */
  @Column({ type: 'uuid', nullable: true })
  adjustedById?: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'adjustedById' })
  adjustedBy?: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  adjustedAt?: Date | null;

  /** Órdenes incluidas en el lote (pivot con snapshot de modo y target). */
  @OneToMany(() => AccountsReceivableOrder, (o) => o.receivable, {
    cascade: false,
  })
  orders: AccountsReceivableOrder[];

  @ManyToMany(() => AccountsReceivablePayment, (p) => p.accounts, {
    cascade: false,
  })
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

  // --- Transient (NO columnas). Calculados por el servicio al listar/ver. ---
  /** Modo de cobro del lote: 'fixed' (Bs tasa fija) o 'usd'. Uniforme por lote. */
  mode?: 'usd' | 'fixed';

  /**
   * Nº de órdenes del lote. En el listado llega agregado por SQL (el pivot no
   * se hidrata); en el detalle es `orders.length`.
   */
  orderCount?: number;
  /** Target USD del lote (modo usd), YA con el ajuste aplicado. */
  targetUsd?: number;
  /** Target Bs del lote (modo fixed), YA con el ajuste aplicado. */
  targetBs?: number;
  /** Target USD sin ajuste (Σ snapshot del pivot). */
  targetBaseUsd?: number;
  /** Target Bs sin ajuste (Σ snapshot del pivot). */
  targetBaseBs?: number;
  /** Cobrado USD (Σ cobros). */
  collectedUsd?: number;
  /** Cobrado Bs (Σ cobros). */
  collectedBs?: number;
  /** Falta por cobrar USD (modo usd). */
  pendingUsd?: number;
  /** Falta por cobrar Bs (modo fixed). */
  pendingBs?: number;
}
