import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { CareCenterPhone } from './care-center-phone.entity';
import { CareCenterPaymentMethod } from './care-center-payment-method.entity';
import { CareCenterServicePrice } from './care-center-service-price.entity';

@Entity({ name: 'care_centers' })
export class CareCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Razón social. Antes era `name`. */
  @Column({ type: 'varchar', length: 200, unique: true })
  businessName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  rif?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => Specialty, { eager: true })
  @JoinTable({
    name: 'care_centers_specialties',
    joinColumn: { name: 'careCenterId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'specialtyId', referencedColumnName: 'id' },
  })
  specialties: Specialty[];

  @OneToMany(() => CareCenterPhone, (phone) => phone.careCenter, {
    cascade: true,
    eager: true,
  })
  phones: CareCenterPhone[];

  @OneToMany(() => CareCenterPaymentMethod, (m) => m.careCenter, {
    cascade: true,
    eager: true,
  })
  paymentMethods: CareCenterPaymentMethod[];

  /**
   * Precios que se pagan al centro por Tipo de Servicio. Sólo los STs que el
   * centro efectivamente realiza. Replace-all en update.
   */
  @OneToMany(() => CareCenterServicePrice, (sp) => sp.careCenter, { eager: true })
  servicePrices: CareCenterServicePrice[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
