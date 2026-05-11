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
import { AccountsReceivable } from './accounts-receivable.entity';

export type AccountsReceivablePaymentType =
  | 'mobile_payment'
  | 'bank_transfer'
  | 'cash_foreign'
  | 'cash_bs'
  | 'other';

export type PaymentCurrency = 'USD' | 'EUR' | 'BS';

@Entity({ name: 'accounts_receivable_payments' })
export class AccountsReceivablePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 24 })
  type: AccountsReceivablePaymentType;

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

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amountInBs: string;

  @ManyToMany(() => AccountsReceivable, (a) => a.payments)
  accounts: AccountsReceivable[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
