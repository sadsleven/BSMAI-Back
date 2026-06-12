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
import { PaymentAccount } from '../../payment-accounts/entities/payment-account.entity';

export type AccountsReceivablePaymentType =
  | 'mobile_payment'
  | 'bank_transfer'
  | 'cash_usd'
  | 'cash_eur'
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

  @Column({ type: 'uuid', nullable: true })
  paymentAccountId?: string | null;

  @ManyToOne(() => PaymentAccount, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'paymentAccountId' })
  paymentAccount?: PaymentAccount | null;

  @Column({ type: 'varchar', length: 3 })
  amountCurrency: PaymentCurrency;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amountValue: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amountInUsd: string;

  /**
   * Snapshot del pago en bolívares según la tasa del propio pago. Usado para
   * comparar contra el target Bs de cuentas con `useFixedRate=true`. Sirve
   * para el caso típico: cada cobro registrado a un seguro con tasa fija
   * descuenta el target en Bs según la tasa aplicada al pago de ese día.
   */
  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
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
