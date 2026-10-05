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
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';
import { TaxUnit } from '../../tax-units/entities/tax-unit.entity';
import { AccountsPayable } from './accounts-payable.entity';
import { AccountsPayablePayment } from './accounts-payable-payment.entity';
import { SeniatPersonType } from '../../shared/utils/seniat-retention';

/**
 * ABONO de un lote de Cuentas por pagar: la unidad de pago al proveedor.
 *
 * Cubre una porción del bruto del lote en USD (`coveredUsd`) a SU propia tasa
 * (`rateBs`) y con SU propia retención (`retentionBs`), snapshoteadas al
 * registrarlo. Pagar un lote en dos partes a tasas distintas produce dos
 * abonos independientes: cambiar la tasa de uno NO toca al otro (el saldo del
 * lote se lleva en USD, no en Bs).
 *
 * El proveedor recibe `netBs` = `grossBs` − `retentionBs`, liquidado con las
 * `payments` del abono (una o varias filas: transferencia, efectivo, …) que
 * deben sumar exactamente ese neto. Cada abono genera su propia obligación con
 * el SENIAT (`taxes_payable.sourceSettlementId`), con la fecha del abono — así
 * un lote pagado en dos meses declara en sus dos períodos fiscales.
 */
@Entity({ name: 'accounts_payable_settlements' })
@Index('idx_aps_payable', ['payableId'])
export class AccountsPayableSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  payableId: string;

  @ManyToOne(() => AccountsPayable, (p) => p.settlements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payableId' })
  payable: AccountsPayable;

  /** Fecha del abono: define el período fiscal de su retención. */
  @Column({ type: 'date' })
  settlementDate: string;

  /** Porción del bruto USD del lote que cubre este abono. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  coveredUsd: string;

  @Column({ type: 'uuid' })
  exchangeRateId: string;

  @ManyToOne(() => ExchangeRate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'exchangeRateId' })
  exchangeRate: ExchangeRate;

  /** Snapshot de la tasa USD/Bs del abono (`exchangeRate.amountBs`). */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  rateBs: string;

  /** Bruto del abono en Bs (= `coveredUsd` × `rateBs`). */
  @Column({ type: 'numeric', precision: 18, scale: 2 })
  grossBs: string;

  /** Régimen SENIAT aplicado (snapshot: el proveedor puede cambiar después). */
  @Column({ type: 'varchar', length: 16 })
  personType: SeniatPersonType;

  /** UT usada para la retención. NULL = el lote no aplica retención. */
  @Column({ type: 'uuid', nullable: true })
  taxUnitId?: string | null;

  @ManyToOne(() => TaxUnit, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'taxUnitId' })
  taxUnit?: TaxUnit | null;

  /** Snapshot del valor de la UT (Bs) usada. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  taxUnitAmountBs: string;

  /** Tasa de retención aplicada (0.03 PNR / 0.05 PJD; 0 si no aplica). */
  @Column({ type: 'numeric', precision: 5, scale: 4, default: 0 })
  taxRate: string;

  /** Sustraendo PRORRATEADO por la porción cubierta (0 para PJD). */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  subtrahendBs: string;

  /** Retención del abono en Bs. */
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  retentionBs: string;

  /** ¿`retentionBs` lo fijó el usuario a mano (no el cálculo prorrateado)? */
  @Column({ type: 'boolean', default: false })
  isCustomRetention: boolean;

  /** Neto entregado al proveedor (= `grossBs` − `retentionBs`). */
  @Column({ type: 'numeric', precision: 18, scale: 2 })
  netBs: string;

  /** Filas de pago que liquidan el neto del abono. */
  @OneToMany(() => AccountsPayablePayment, (p) => p.settlement, {
    cascade: false,
  })
  payments: AccountsPayablePayment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
