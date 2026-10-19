import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { AccountsReceivable } from './accounts-receivable.entity';
import { Order } from '../../orders/entities/order.entity';
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';

/** Porción de la orden cubierta por la fila del pivot. */
export type AroPortion = 'full' | 'fixed' | 'indexed';

/**
 * Pivot lote ↔ orden. PK compuesta (receivableId, orderId). Snapshot al agregar:
 * `useFixedRate` fija el modo de cobro (Bs tasa fija vs USD), `exchangeRateId`
 * la tasa de esa orden (sólo tasa fija) y `targetUsd`/`targetBs` el monto
 * objetivo. Todas las órdenes de un lote comparten deudor y modo, pero NO
 * tasa: en modo tasa fija cada orden conserva la suya.
 *
 * `portion`: una orden de seguro no indexado con STs indexados se parte en dos
 * deudas — `fixed` (STs no indexados, Bs a la tasa de la orden) e `indexed`
 * (STs indexados, USD a la tasa del día del cobro) — que viven en lotes de
 * modos distintos. `full` = orden completa (caso sin mezcla). Exclusividad:
 * UNIQUE(orderId, portion) (`uq_aro_order_portion`); `full` excluye a las
 * porciones y viceversa (invariante del service).
 */
@Entity({ name: 'accounts_receivable_orders' })
@Index('idx_aro_receivable', ['receivableId'])
export class AccountsReceivableOrder {
  @PrimaryColumn({ type: 'uuid' })
  receivableId: string;

  @PrimaryColumn({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'varchar', length: 8, default: 'full' })
  portion: AroPortion;

  @Column({ type: 'boolean', default: false })
  useFixedRate: boolean;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  targetUsd?: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  targetBs?: string | null;

  /**
   * Tasa USD/Bs con la que ESTA orden (o porción) se cobra en ESTE lote. Sólo
   * aplica a filas `useFixedRate=true` (seguro no indexado): cada orden trae
   * su tasa amarrada, el lote NO tiene una tasa única. Snapshot de
   * `order.fixedExchangeRateId` al agregarla; ajustable por orden desde el
   * detalle del lote, que recalcula `targetBs = targetUsd × amountBs` sin
   * tocar el resto del lote ni la tasa de la orden (la factura ya salió con
   * la suya).
   */
  @Column({ type: 'uuid', nullable: true })
  exchangeRateId?: string | null;

  @ManyToOne(() => ExchangeRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'exchangeRateId' })
  exchangeRate?: ExchangeRate | null;

  @ManyToOne(() => AccountsReceivable, (r) => r.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receivableId' })
  receivable: AccountsReceivable;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;
}
