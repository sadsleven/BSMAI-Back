import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InsurancePhone } from './insurance-phone.entity';
import { Patient } from '../../patients/entities/patient.entity';

@Entity({ name: 'insurances' })
export class Insurance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => InsurancePhone, (phone) => phone.insurance, {
    cascade: true,
    eager: true,
  })
  phones: InsurancePhone[];

  @ManyToMany(() => Patient, (p) => p.insurances)
  patients: Patient[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
