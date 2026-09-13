import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Order } from './order.entity';
import { OrderInvoice } from './order-invoice.entity';

/**
 * Pivot factura ↔ órdenes cubiertas. Una factura puede agrupar varias órdenes
 * del mismo contratante (paciente atendido varias veces que pide una sola
 * factura); `order_invoices.orderId` es sólo la orden EMISORA.
 *
 * `cancelled` espeja `OrderInvoice.status` y lo escriben emisión y anulación en
 * la misma transacción: es lo que permite el índice parcial
 * `uq_oio_order_active` (una orden a lo sumo en UNA factura vigente).
 */
@Entity({ name: 'order_invoice_orders' })
@Unique('uq_oio_invoice_order', ['invoiceId', 'orderId'])
@Index('idx_oio_invoice', ['invoiceId'])
@Index('idx_oio_order', ['orderId'])
export class OrderInvoiceOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => OrderInvoice, (i) => i.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice?: OrderInvoice;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  /** Espejo de `invoice.status === 'cancelled'`. */
  @Column({ type: 'boolean', default: false })
  cancelled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
