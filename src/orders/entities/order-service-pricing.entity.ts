import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';

export type OrderServicePricingKind =
  | 'particular'
  | 'insurance'
  | 'doctor'
  | 'care_center';

/**
 * Snapshot del precio aplicado a un Tipo de Servicio dentro de una orden, por origen:
 *  - `particular`/`insurance` capturados al crear la orden (Paso 1, cobro).
 *  - `doctor`/`care_center` capturados al facturar (Paso 4, pago al proveedor).
 *
 * PK compuesta (orderId, serviceTypeId, kind) — una orden puede tener cobro + pago
 * para el mismo ST sin chocar.
 */
@Entity({ name: 'order_service_pricing' })
@Index('IDX_osp_order', ['orderId'])
export class OrderServicePricing {
  @PrimaryColumn({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @PrimaryColumn({ type: 'uuid' })
  serviceTypeId: string;

  @ManyToOne(() => ServiceType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'serviceTypeId' })
  serviceType: ServiceType;

  @PrimaryColumn({ type: 'varchar', length: 16 })
  kind: OrderServicePricingKind;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  priceUsd: string;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  priceEur: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
