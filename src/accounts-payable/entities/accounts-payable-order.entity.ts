import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { AccountsPayable } from './accounts-payable.entity';
import { OrderInternalOrder } from '../../orders/entities/order-internal-order.entity';

/**
 * Pivot lote ↔ orden interna. PK compuesta (payableId, internalOrderId).
 * `grossUsd` = snapshot de `order_internal_orders.providerAmountUsd` al agregar
 * la orden al lote (estable aunque cambie la orden). Una orden interna está a lo
 * sumo en un lote activo (`uq_apo_internal_order`); al anular el lote se borran
 * físicamente estas filas → la orden vuelve a Pendientes.
 */
@Entity({ name: 'accounts_payable_orders' })
@Index('idx_apo_payable', ['payableId'])
export class AccountsPayableOrder {
  @PrimaryColumn({ type: 'uuid' })
  payableId: string;

  @PrimaryColumn({ type: 'uuid' })
  internalOrderId: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  grossUsd: string;

  @ManyToOne(() => AccountsPayable, (p) => p.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payableId' })
  payable: AccountsPayable;

  @ManyToOne(() => OrderInternalOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'internalOrderId' })
  internalOrder: OrderInternalOrder;
}
