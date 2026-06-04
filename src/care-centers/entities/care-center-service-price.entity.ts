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
import { CareCenter } from './care-center.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';

/**
 * Precio que se le paga al Centro de Atención por un Tipo de Servicio.
 * Un Centro carga sólo los STs que efectivamente realiza.
 */
@Entity({ name: 'care_center_service_prices' })
@Index('UQ_ccsp_carecenter_st', ['careCenterId', 'serviceTypeId'], { unique: true })
export class CareCenterServicePrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  careCenterId: string;

  @ManyToOne(() => CareCenter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'careCenterId' })
  careCenter: CareCenter;

  @Column({ type: 'uuid' })
  serviceTypeId: string;

  @ManyToOne(() => ServiceType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'serviceTypeId' })
  serviceType: ServiceType;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  priceUsd: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
