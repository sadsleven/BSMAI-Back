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
   * Cantidad de este ST en la orden (ej. sesiones). Siempre ≥ 1; sólo > 1 si el
   * ST tiene `allowsQuantity`. El precio de la orden multiplica unidad × cantidad.
   */
  @Column({ type: 'integer', default: 1 })
  quantity: number;

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
