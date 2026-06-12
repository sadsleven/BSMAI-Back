import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { DoctorPhone } from './doctor-phone.entity';
import { DoctorPaymentMethod } from './doctor-payment-method.entity';
import { DoctorServicePrice } from './doctor-service-price.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'doctors' })
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16, unique: true })
  cedula: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 150 })
  firstName: string;

  @Column({ type: 'varchar', length: 150 })
  lastName: string;

  @Column({ type: 'boolean', default: false })
  isLegalEntity: boolean;

  /** Sólo presente cuando isLegalEntity === true. */
  @Column({ type: 'varchar', length: 24, nullable: true, unique: true })
  rif?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => Specialty, { eager: true })
  @JoinTable({
    name: 'doctors_specialties',
    joinColumn: { name: 'doctorId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'specialtyId', referencedColumnName: 'id' },
  })
  specialties: Specialty[];

  @OneToMany(() => DoctorPhone, (phone) => phone.doctor, {
    cascade: true,
    eager: true,
  })
  phones: DoctorPhone[];

  @OneToMany(() => DoctorPaymentMethod, (m) => m.doctor, {
    cascade: true,
    eager: true,
  })
  paymentMethods: DoctorPaymentMethod[];

  /**
   * Precios que se pagan al doctor por Tipo de Servicio realizado. Sólo los STs
   * que el doctor efectivamente realiza. Replace-all en update.
   */
  @OneToMany(() => DoctorServicePrice, (sp) => sp.doctor, { eager: true })
  servicePrices: DoctorServicePrice[];

  /**
   * Cuenta de usuario vinculada (acceso al sistema como proveedor). Nullable:
   * un doctor sin acceso no tiene user. FK ON DELETE SET NULL.
   */
  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
