import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AccountsReceivable } from './accounts-receivable.entity';
import { Order } from '../../orders/entities/order.entity';

/**
 * Pivot lote ↔ orden. PK compuesta (receivableId, orderId). Snapshot al agregar:
 * `useFixedRate` fija el modo de cobro (Bs tasa fija vs USD) y `targetUsd`/
 * `targetBs` el monto objetivo. Todas las órdenes de un lote comparten deudor y
 * modo. Una orden está a lo sumo en un lote activo (`uq_aro_order`).
 */
@Entity({ name: 'accounts_receivable_orders' })
@Index('idx_aro_receivable', ['receivableId'])
export class AccountsReceivableOrder {
  @PrimaryColumn({ type: 'uuid' })
  receivableId: string;

  @PrimaryColumn({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'boolean', default: false })
  useFixedRate: boolean;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  targetUsd?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  targetBs?: string | null;

  @ManyToOne(() => AccountsReceivable, (r) => r.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receivableId' })
  receivable: AccountsReceivable;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
