import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { User } from '../../users/entities/user.entity';
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';

export type OrderInvoiceStatus = 'active' | 'cancelled';

/**
 * Factura emitida en el Paso 4. Una orden puede acumular varias: la vigente
 * (`status='active'`, a lo sumo una — índice parcial `uq_order_invoices_active`)
 * más las que se anularon. Anular una factura NO cancela la orden.
 *
 * `number` es el valor numérico del N° de factura y es UNIQUE global: un número
 * jamás se reutiliza, ni siquiera el de una factura anulada. `controlNumber` es
 * derivado (`number + 50` con dos ceros delante), no se captura a mano.
 */
@Entity({ name: 'order_invoices' })
@Index('idx_order_invoices_order', ['orderId'])
export class OrderInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (o) => o.invoices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  /**
   * Valor numérico del N° de factura (UNIQUE global, nunca reutilizable).
   * `null` sólo en facturas históricas con numeración no numérica.
   */
  @Column({ type: 'bigint', nullable: true })
  number?: string | null;

  /** N° de factura tal como se imprime (con ceros a la izquierda). */
  @Column({ type: 'varchar', length: 50 })
  invoiceNumber: string;

  /** N° de control derivado del de factura. */
  @Column({ type: 'varchar', length: 50 })
  controlNumber: string;

  @Column({ type: 'date' })
  invoiceDate: string;

  /**
   * ¿Esta factura imprime la fila "Tasa de cambio BCV"? `null` = regla derivada
   * (`!order.useFixedRate`), que es lo que traen las facturas históricas.
   */
  @Column({ type: 'boolean', nullable: true })
  showExchangeRate?: boolean | null;

  /** Tasa USD/Bs con la que se emitió esta factura. */
  @Column({ type: 'uuid', nullable: true })
  exchangeRateId?: string | null;

  @ManyToOne(() => ExchangeRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'exchangeRateId' })
  exchangeRate?: ExchangeRate | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: OrderInvoiceStatus;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancelReason?: string | null;

  @Column({ type: 'uuid', nullable: true })
  cancelledById?: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'cancelledById' })
  cancelledBy?: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdById?: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
