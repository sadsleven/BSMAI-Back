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
import { Insurance } from './insurance.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';

/**
 * Precio que el Seguro cobra (paga a la empresa) por un Tipo de Servicio.
 * Un Seguro carga sólo los STs que efectivamente cubre.
 */
@Entity({ name: 'insurance_service_prices' })
@Index('UQ_isp_insurance_st', ['insuranceId', 'serviceTypeId'], {
  unique: true,
})
export class InsuranceServicePrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  insuranceId: string;

  @ManyToOne(() => Insurance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'insuranceId' })
  insurance: Insurance;

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
