import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type Currency = 'USD' | 'EUR';
export const CURRENCIES: Currency[] = ['USD', 'EUR'];

@Entity({ name: 'exchange_rates' })
@Index('idx_exchange_rates_currency_effective_date', [
  'currency',
  'effectiveDate',
])
export class ExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 3 })
  currency: Currency;

  /** Monto en bolívares por 1 unidad de la moneda. Histórico — no se sobrescribe. */
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amountBs: string;

  /** Fecha y hora efectiva. ISO 8601 string, con TZ. */
  @Column({ type: 'timestamptz' })
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
