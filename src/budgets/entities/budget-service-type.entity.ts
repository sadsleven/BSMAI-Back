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
import { Budget } from './budget.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import type { ProviderType } from '../../orders/entities/order.entity';

/**
 * Línea de servicio de un presupuesto — un "PROCEDIMIENTO A REALIZAR" del
 * documento, con su precio.
 *
 * Difiere de {@link OrderServiceType} en tres cosas, todas por la misma razón
 * (un presupuesto es una propuesta, no una orden ejecutada):
 *  - PK propia (`id`) en vez de `(budgetId, serviceTypeId)`: el mismo Tipo de
 *    Servicio puede aparecer dos veces con nombres y precios distintos
 *    (ej. "RX tórax frontal" y "RX tórax lateral").
 *  - `unitPriceUsd` es un SNAPSHOT editable: el presupuesto entregado conserva
 *    el precio que se cotizó aunque después cambie el baremo o el catálogo.
 *  - El proveedor (doctor / centro) es OPCIONAL: al presupuestar normalmente
 *    todavía no se sabe quién atiende. Si se indica, viaja a la orden al
 *    convertir y ahorra volver a elegirlo.
 */
@Entity({ name: 'budget_service_types' })
@Index('idx_bst_budget', ['budgetId'])
@Index('idx_bst_serviceType', ['serviceTypeId'])
export class BudgetServiceType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  budgetId: string;

  @ManyToOne(() => Budget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budgetId' })
  budget: Budget;

  @Column({ type: 'uuid' })
  serviceTypeId: string;

  @ManyToOne(() => ServiceType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'serviceTypeId' })
  serviceType: ServiceType;

  @Column({ type: 'uuid', nullable: true })
  specialtyId?: string | null;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'specialtyId' })
  specialty?: Specialty | null;

  /**
   * Nombre con el que el servicio sale IMPRESO en el presupuesto (ej.
   * "CONSULTA DE CARDIOLOGÍA"). Obligatorio, igual que en la orden.
   */
  @Column({ type: 'varchar', length: 300 })
  customName: string;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  /**
   * Precio unitario en USD congelado al guardar. Se propone desde el catálogo
   * (baremo del seguro o precio Particular) y el usuario puede ajustarlo; el
   * total de la línea es `unitPriceUsd × quantity`.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  unitPriceUsd: string;

  /**
   * Precio de catálogo al guardar, para distinguir una línea ajustada de una
   * a precio de lista. Null cuando el catálogo no tenía precio para ese ST.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  catalogPriceUsd?: string | null;

  /** Proveedor tentativo. Null los tres ⇒ todavía sin asignar. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  providerType?: ProviderType | null;

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

  /** Orden de impresión (0-based). Las filas salen tal como se capturaron. */
  @Column({ type: 'integer', default: 0 })
  position: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
