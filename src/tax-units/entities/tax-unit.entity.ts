import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tax_units' })
@Index('idx_tax_units_effective_date', ['effectiveDate'])
export class TaxUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Monto de la UT en bolívares. Histórico — no se sobrescribe. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amountBs: string;

  /** Fecha desde la cual rige (publicación Gaceta Oficial). */
  @Column({ type: 'date' })
  effectiveDate: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
