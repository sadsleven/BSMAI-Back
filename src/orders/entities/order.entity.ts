import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Contractor } from '../../contractors/entities/contractor.entity';
import { Insurance } from '../../insurances/entities/insurance.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';
import { Pathology } from '../../pathologies/entities/pathology.entity';
import { User } from '../../users/entities/user.entity';
import { OrderPayment } from './order-payment.entity';

export type OrderStatus =
  | 'draft'
  | 'in_progress'
  | 'attended'
  | 'report_issued'
  | 'finalized'
  | 'cancelled';

export type OrderType = 'cash' | 'credit' | 'insurance' | 'cashea';

export type ProviderType = 'doctor' | 'care_center';

export type OrderCurrency = 'USD' | 'EUR';

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

  @Column({ type: 'uuid' })
  specialtyId: string;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialtyId' })
  specialty: Specialty;

  @Column({ type: 'uuid' })
  serviceTypeId: string;

  @ManyToOne(() => ServiceType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'serviceTypeId' })
  serviceType: ServiceType;

  @Column({ type: 'uuid' })
  pathologyId: string;

  @ManyToOne(() => Pathology, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pathologyId' })
  pathology: Pathology;

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

  @OneToMany(() => OrderPayment, (p) => p.order, { cascade: false })
  payments: OrderPayment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
