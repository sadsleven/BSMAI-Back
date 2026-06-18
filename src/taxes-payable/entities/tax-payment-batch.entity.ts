import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaxPayablePayment } from './tax-payable-payment.entity';
import { TaxPayable } from './tax-payable.entity';

export type TaxPaymentBatchStatus = 'paid' | 'unpaid' | 'partially_paid';

/**
 * LOTE de pago al SENIAT. Creado por el usuario; agrupa N obligaciones de
 * retención (`obligations` → `TaxPayable` con `taxPaymentBatchId`) que pueden
 * ser de VARIOS proveedores (el proveedor vive en cada obligación, no en el
 * lote) y acumula M pagos. Target = Σ `taxAmountBs` de sus obligaciones. Al
 * quedar pagado, sus obligaciones pasan a `paid`.
 */
@Entity({ name: 'tax_payment_batches' })
@Index('idx_tpb_status', ['status'])
export class TaxPaymentBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  taxBatchNumber: string;

  @Column({ type: 'varchar', length: 16, default: 'unpaid' })
  status: TaxPaymentBatchStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt?: Date | null;

  /** Obligaciones de retención incluidas en el lote. */
  @OneToMany(() => TaxPayable, (t) => t.taxPaymentBatch, { cascade: false })
  obligations: TaxPayable[];

  @ManyToMany(() => TaxPayablePayment, (p) => p.batches, { cascade: false })
  @JoinTable({
    name: 'tax_payment_batch_payment_links',
    joinColumn: { name: 'batchId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'paymentId', referencedColumnName: 'id' },
  })
  payments: TaxPayablePayment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  // --- Transient (NO columnas). Calculados por el servicio al listar/ver. ---
  /** Target Bs del lote = Σ retención de las obligaciones. */
  targetBs?: number;
  /** Pagado al SENIAT en Bs (Σ pagos del lote). */
  paidBs?: number;
  /** Falta por pagar al SENIAT en Bs. */
  pendingBs?: number;
}
