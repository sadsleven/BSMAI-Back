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

@Entity({ name: 'care_centers' })
export class CareCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 24, unique: true })
  rif: string;

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

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
