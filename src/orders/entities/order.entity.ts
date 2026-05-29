import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Contractor } from '../../contractors/entities/contractor.entity';
import { Insurance } from '../../insurances/entities/insurance.entity';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { Pathology } from '../../pathologies/entities/pathology.entity';
import { User } from '../../users/entities/user.entity';
import { OrderPayment } from './order-payment.entity';
import { OrderServiceType } from './order-service-type.entity';
import { OrderServicePricing } from './order-service-pricing.entity';
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';

export type OrderStatus =
  | 'draft'
  | 'in_progress'
  | 'attended'
  | 'report_issued'
  | 'finalized'
  | 'cancelled';

export type OrderType = 'cash' | 'credit' | 'insurance' | 'cashea';

export type ProviderType = 'doctor' | 'care_center';

export type InsuranceSource = 'direct' | 'via_contractor';

export type OrderCurrency = 'USD' | 'EUR';

export type DoctorAmountCurrency = 'USD' | 'EUR' | 'BS';

@Entity({ name: 'orders' })
@Index('idx_orders_branch', ['branchId'])
@Index('idx_orders_holder', ['holderId'])
@Index('idx_orders_patient', ['patientId'])
@Index('idx_orders_status', ['status'])
@Index('idx_orders_orderDate', ['orderDate'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  orderNumber: string;

  @Column({ type: 'uuid' })
  branchId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ type: 'varchar', length: 16 })
  type: OrderType;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status: OrderStatus;

  @Column({ type: 'uuid' })
  holderId: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'holderId' })
  holder: Patient;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  contractorId?: string | null;

  @ManyToOne(() => Contractor, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'contractorId' })
  contractor?: Contractor | null;

  @Column({ type: 'uuid', nullable: true })
  insuranceId?: string | null;

  @ManyToOne(() => Insurance, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'insuranceId' })
  insurance?: Insurance | null;

  /**
   * Origen del seguro al crear la orden. Requerido sólo si `type='insurance'`.
   *  - 'direct': el seguro fue asignado directamente al titular (sin contratista).
   *  - 'via_contractor': el seguro proviene de un contratista del titular.
   *
   * Cuando `source='via_contractor'`, `contractorId` es requerido; cuando
   * `source='direct'`, `contractorId` debe ser null. Validado en service.
   */
  @Column({ type: 'varchar', length: 16, nullable: true })
  insuranceSource?: InsuranceSource | null;

  /**
   * Clave de servicio externa del seguro (referencia/autorización). Aplica
   * sólo a órdenes `type='insurance'`. Opcional. Texto libre ≤30 chars.
   */
  @Column({ type: 'varchar', length: 30, nullable: true })
  serviceKey?: string | null;

  @Column({ type: 'uuid' })
  specialtyId: string;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialtyId' })
  specialty: Specialty;

  /**
   * Tipos de servicio + su proveedor (Doctor o CareCenter). Una orden puede
   * combinar STs prestados por distintos proveedores.
   */
  @OneToMany(() => OrderServiceType, (ost) => ost.order, { cascade: false })
  orderServiceTypes: OrderServiceType[];

  @ManyToMany(() => Pathology, { eager: false })
  @JoinTable({
    name: 'order_pathologies',
    joinColumn: { name: 'orderId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'pathologyId', referencedColumnName: 'id' },
  })
  pathologies: Pathology[];

  @Column({ type: 'date' })
  orderDate: string;

  @Column({ type: 'timestamptz' })
  appointmentDate: Date;

  @Column({ type: 'varchar', length: 3 })
  priceCurrency: OrderCurrency;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  priceAmount: string;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  /**
   * Autorización de monto (Paso 1). Cuando el usuario que edita no tiene
   * `orders.edit-amount`, otro usuario validador autoriza e ingresa el monto.
   * Se guarda quién lo autorizó, cuándo y la observación.
   */
  @Column({ type: 'uuid', nullable: true })
  amountAuthorizedById?: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'amountAuthorizedById' })
  amountAuthorizedBy?: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  amountAuthorizedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  amountAuthorizationNote?: string | null;

  @OneToMany(() => OrderPayment, (p) => p.order, { cascade: false })
  payments: OrderPayment[];

  /** Snapshots de precios por ST + kind. Capturados en Paso 1 (cobro) y Paso 4 (pago). */
  @OneToMany(() => OrderServicePricing, (osp) => osp.order, { cascade: false })
  servicePricing: OrderServicePricing[];

  // ---- Paso 2: Atención del paciente ----
  @Column({ type: 'boolean', default: false })
  attended: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  attendedAt?: Date | null;

  // ---- Paso 3: Informe médico y estudios ----
  @Column({ type: 'text', nullable: true })
  otherStudies?: string | null;

  // ---- Paso 4: Facturación y liquidación ----
  /**
   * Monto sugerido calculado al entrar al Paso 4 = sum de precios del Doctor o
   * Centro de Atención para los STs de la orden en `priceCurrency`. Snapshot al
   * momento de facturar. Si el admin ajusta `doctorAmount`, este campo conserva
   * el sugerido para auditoría.
   */
  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  doctorAmountSuggested?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  doctorAmount?: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  doctorAmountCurrency?: DoctorAmountCurrency | null;

  @Column({ type: 'uuid', nullable: true })
  billingExchangeRateId?: string | null;

  @ManyToOne(() => ExchangeRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'billingExchangeRateId' })
  billingExchangeRate?: ExchangeRate | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
