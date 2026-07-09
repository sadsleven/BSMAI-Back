import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { OrderInternalOrder } from './order-internal-order.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import type { ProviderType } from './order.entity';

/**
 * Tipo de Servicio asignado a una orden, con su proveedor propio.
 *
 * Una orden puede combinar STs prestados por distintos doctores y/o centros;
 * por eso `providerType` + `doctorId|careCenterId` viven aquí, no en `Order`.
 * Validación XOR de los IDs garantizada por CHECK (`CHK_ost_provider_xor`).
 */
@Entity({ name: 'order_service_types' })
@Index('IDX_ost_doctor', ['doctorId'])
@Index('IDX_ost_careCenter', ['careCenterId'])
@Index('IDX_ost_internalOrder', ['internalOrderId'])
export class OrderServiceType {
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

  @Column({ type: 'varchar', length: 16 })
  providerType: ProviderType;

  /**
   * Orden interna (número por proveedor) a la que pertenece esta fila. FK real
   * a {@link OrderInternalOrder}: garantiza que toda fila de servicio apunta a
   * un proveedor numerado. La factura del Paso 4 imprime `internalOrder.internalNumber`
   * por fila.
   */
  @Column({ type: 'uuid' })
  internalOrderId: string;

  @ManyToOne(() => OrderInternalOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'internalOrderId' })
  internalOrder: OrderInternalOrder;

  /**
   * Cantidad de este ST en la orden (ej. sesiones). Siempre ≥ 1 (default 1).
   * Todo ST admite cantidad. El precio de la orden multiplica unidad × cantidad.
   */
  @Column({ type: 'integer', default: 1 })
  quantity: number;

  /**
   * Nombre de este ST para la orden. OBLIGATORIO. El usuario lo elige en el
   * Paso 1 con un selector que reutiliza nombres previos del mismo ST y permite
   * dar de alta uno nuevo (ej. "RX tórax frontal"). Es el nombre que se muestra
   * en el Paso 2 (órdenes internas: Excel/PDF), el Paso 4 (factura) y el detalle
   * de la orden.
   */
  @Column({ type: 'varchar', length: 300 })
  customName: string;

  /**
   * ST indexado dentro de una orden con seguro no indexado (`useFixedRate=true`):
   * este ST se cobra a la tasa del día del cobro, NO a la tasa fija de la orden.
   * Sólo aplica en órdenes en modo tasa fija; el service lo fuerza a false en
   * cualquier otro caso.
   */
  @Column({ type: 'boolean', default: false })
  isIndexed: boolean;

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
