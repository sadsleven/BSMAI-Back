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
import { InsuranceServicePrice } from './insurance-service-price.entity';
import { Contractor } from '../../contractors/entities/contractor.entity';

@Entity({ name: 'insurances' })
export class Insurance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fiscalAddress?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  rif?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => InsurancePhone, (phone) => phone.insurance, {
    cascade: true,
    eager: true,
  })
  phones: InsurancePhone[];

  /**
   * Precios de cobro al seguro por Tipo de Servicio. Sólo los STs que el seguro
   * efectivamente cubre — no todos los existentes. Replace-all en update.
   */
  @OneToMany(() => InsuranceServicePrice, (sp) => sp.insurance, { eager: true })
  servicePrices: InsuranceServicePrice[];

  @ManyToMany(() => Contractor, (c) => c.insurances)
  contractors: Contractor[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
