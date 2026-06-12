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
import { Doctor } from './doctor.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';

/**
 * Precio que se le paga al Doctor por un Tipo de Servicio realizado.
 * Un Doctor carga sólo los STs que efectivamente realiza.
 */
@Entity({ name: 'doctor_service_prices' })
@Index('UQ_dsp_doctor_st', ['doctorId', 'serviceTypeId'], { unique: true })
export class DoctorServicePrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

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
