import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import { AccountsPayable } from '../../accounts-payable/entities/accounts-payable.entity';
import { TaxUnit } from '../../tax-units/entities/tax-unit.entity';
import { TaxPaymentBatch } from './tax-payment-batch.entity';

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

  /**
   * Lote de Cuentas por pagar que originó esta retención (1:1). Se generó al
   * quedar el lote AP totalmente pagado. CASCADE: anular el lote AP (sin haber
   * pagado la retención al SENIAT) elimina la obligación.
   */
  @Column({ type: 'uuid', nullable: true })
  sourcePayableId?: string | null;

  @ManyToOne(() => AccountsPayable, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'sourcePayableId' })
  sourcePayable?: AccountsPayable | null;

  /** Lote SENIAT al que pertenece esta obligación (null = pendiente, no agrupada). */
  @Column({ type: 'uuid', nullable: true })
  taxPaymentBatchId?: string | null;

  @ManyToOne(() => TaxPaymentBatch, (b) => b.obligations, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'taxPaymentBatchId' })
  taxPaymentBatch?: TaxPaymentBatch | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  /**
   * Transient (NO columna). Números de orden interna del lote AP que originó esta
   * retención. Lo popula el servicio al listar/ver para los comprobantes/UI.
   */
  internalNumbers?: string[];
}
