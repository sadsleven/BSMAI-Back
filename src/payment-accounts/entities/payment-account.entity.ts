import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PaymentAccountType = 'mobile_payment' | 'bank_transfer' | 'other';

/**
 * Cuenta propia del negocio donde se recibe dinero. Catálogo global,
 * referenciado desde `order_payments` y `accounts_receivable_payments`
 * cuando el pago es de tipo `mobile_payment`, `bank_transfer` u `other`.
 *
 * Estructura polimórfica: la tabla tiene un CHECK XOR que sólo admite
 * combinaciones válidas de campos por `type`.
 */
@Entity({ name: 'payment_accounts' })
@Index('idx_pa_type', ['type'])
@Index('idx_pa_is_active', ['isActive'])
export class PaymentAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 24 })
  type: PaymentAccountType;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // mobile_payment + bank_transfer
  @Column({ type: 'varchar', length: 8, nullable: true })
  bankCode?: string | null;

  // mobile_payment
  @Column({ type: 'varchar', length: 11, nullable: true })
  phoneNumber?: string | null;

  // mobile_payment + bank_transfer (cédula/RIF del titular)
  @Column({ type: 'varchar', length: 24, nullable: true })
  idDocument?: string | null;

  // mobile_payment + bank_transfer
  @Column({ type: 'varchar', length: 200, nullable: true })
  accountHolderName?: string | null;

  // bank_transfer
  @Column({ type: 'varchar', length: 20, nullable: true })
  accountNumber?: string | null;

  // other
  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
