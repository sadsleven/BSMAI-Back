import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';
import { AccountsPayable } from './accounts-payable.entity';

export type AccountsPayablePaymentType =
  | 'mobile_payment'
  | 'bank_transfer'
  | 'cash_usd'
  | 'cash_eur'
  | 'cash_bs'
  | 'other';

export type PaymentCurrency = 'USD' | 'EUR' | 'BS';

@Entity({ name: 'accounts_payable_payments' })
export class AccountsPayablePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 24 })
  type: AccountsPayablePaymentType;

  @Column({ type: 'date' })
  paymentDate: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  referenceNumber?: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  bankCode?: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  accountNumber?: string | null;

  @Column({ type: 'uuid', nullable: true })
  exchangeRateId?: string | null;

  @ManyToOne(() => ExchangeRate, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'exchangeRateId' })
  exchangeRate?: ExchangeRate | null;

  @Column({ type: 'varchar', length: 3 })
  amountCurrency: PaymentCurrency;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amountValue: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amountInUsd: string;

  /** Monto del pago en bolívares (snapshot a la tasa usada). Para acumular
   * pagos parciales al proveedor de forma exacta. */
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amountInBs: string;

  @ManyToMany(() => AccountsPayable, (a) => a.payments)
  accounts: AccountsPayable[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
