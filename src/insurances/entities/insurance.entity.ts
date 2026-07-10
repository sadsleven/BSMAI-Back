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

  /** Nombre corto / abreviatura del seguro. Opcional, no único. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  shortName?: string | null;

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

  /**
   * Cuando true (UI: "No indexado"), la cuenta por cobrar se fija en Bs a la
   * tasa del día de la orden (se le asigna una tasa a la orden en el Paso 1).
   * Cuando false (UI: "Indexado"), se cobra a la tasa del día del cobro (USD
   * flotante). Nota: la nomenclatura de negocio quedó invertida respecto al
   * nombre de la columna; la columna se conserva por compatibilidad.
   */
  @Column({ type: 'boolean', default: false })
  isIndexed: boolean;

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
