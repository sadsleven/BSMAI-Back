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
import { Doctor } from '../../doctors/entities/doctor.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import type { ProviderType } from './order.entity';

/**
 * "Orden interna" — una por proveedor distinto (Doctor o Centro) de una orden.
 *
 * Cada proveedor distinto recibe su PROPIO número de orden (`internalNumber`),
 * extraído consecutivamente de la secuencia compartida `orders_seq`. Es el
 * número que se imprime en la orden interna del Paso 2, en la fila de
 * facturación del Paso 4 y por el que se busca/lista en cuentas por pagar y
 * retenciones. `orders.orderNumber` queda como número BASE de la orden
 * (= el `internalNumber` del proveedor con `sequencePosition = 1`, congelado).
 *
 * Tabla "dura" (sin `deletedAt`): quitar un proveedor en borrador BORRA la fila
 * y QUEMA su número (gap aceptable; la secuencia nunca retrocede, jamás se
 * reutiliza). XOR `doctorId`/`careCenterId` (CHECK `CHK_iio_provider_xor`);
 * unique parcial por (orden, proveedor); `internalNumber` UNIQUE entre las
 * filas VIVAS (`WHERE NOT cancelled`) — el número de una orden CANCELADA queda
 * libre para reutilizarlo a mano en otra orden.
 */
@Entity({ name: 'order_internal_orders' })
@Index('IDX_iio_order', ['orderId'])
export class OrderInternalOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'varchar', length: 16 })
  providerType: ProviderType;

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

  /**
   * Número de orden interna de este proveedor. Extraído de `orders_seq`.
   * UNIQUE entre las filas VIVAS (`uq_iio_internal_number_active`,
   * `WHERE NOT cancelled`): el número de una orden cancelada se puede
   * reutilizar a mano en otra orden.
   */
  @Column({ type: 'varchar', length: 32 })
  internalNumber: string;

  /**
   * Espejo de `orders.status = 'cancelled'` de la orden dueña. Existe sólo
   * para que el UNIQUE parcial de `internalNumber` pueda excluir las
   * canceladas (un índice parcial no puede mirar otra tabla). Lo mantienen
   * `OrdersService.cancel` / `uncancel`; nunca llega desde un DTO.
   */
  @Column({ type: 'boolean', default: false })
  cancelled: boolean;

  /**
   * Monto a pagar a este proveedor en USD. Se popula en el Paso 4
   * (`OrdersService.billing`) con el `amount` facturado del proveedor. Es la
   * "unidad de deuda" (pendiente) del módulo Cuentas por pagar: al armar un lote
   * se snapshotea en `accounts_payable_orders.grossUsd`. `null` hasta facturar.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  providerAmountUsd?: string | null;

  /** Ordinal 1-based del proveedor dentro de la orden (orden de aparición). `1` = base. */
  @Column({ type: 'integer' })
  sequencePosition: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
