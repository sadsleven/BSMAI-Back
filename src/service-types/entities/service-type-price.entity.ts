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
import { ServiceType } from './service-type.entity';
import { Insurance } from '../../insurances/entities/insurance.entity';

/**
 * Precio de un tipo de servicio para un seguro o "Particular" (insuranceId NULL).
 * Cualquiera de los dos montos puede ser nulo si todavía no se cargó.
 */
@Entity({ name: 'service_type_prices' })
@Index('IDX_stp_serviceTypeId', ['serviceTypeId'])
export class ServiceTypePrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  serviceTypeId: string;

  @ManyToOne(() => ServiceType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceTypeId' })
  serviceType: ServiceType;

  @Column({ type: 'uuid', nullable: true })
  insuranceId?: string | null;

  @ManyToOne(() => Insurance, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'insuranceId' })
  insurance?: Insurance | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  priceUsd?: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  priceEur?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
