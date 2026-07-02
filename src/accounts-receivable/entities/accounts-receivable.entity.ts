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

  /** Órdenes incluidas en el lote (pivot con snapshot de modo y target). */
  @OneToMany(() => AccountsReceivableOrder, (o) => o.receivable, { cascade: false })
  orders: AccountsReceivableOrder[];

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

  // --- Transient (NO columnas). Calculados por el servicio al listar/ver. ---
  /** Modo de cobro del lote: 'fixed' (Bs tasa fija) o 'usd'. Uniforme por lote. */
  mode?: 'usd' | 'fixed';
  /** Target USD del lote (modo usd). */
  targetUsd?: number;
  /** Target Bs del lote (modo fixed). */
  targetBs?: number;
  /** Cobrado USD (Σ cobros). */
  collectedUsd?: number;
  /** Cobrado Bs (Σ cobros). */
  collectedBs?: number;
  /** Falta por cobrar USD (modo usd). */
  pendingUsd?: number;
  /** Falta por cobrar Bs (modo fixed). */
  pendingBs?: number;
}
