import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export const PAYMENT_TYPES = [
  'mobile_payment',
  'bank_transfer',
  'cash_usd',
  'cash_eur',
  'cash_bs',
  'other',
] as const;
export type PaymentTypeValue = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_CURRENCIES = ['USD', 'EUR', 'BS'] as const;

export class CreateOrderPaymentDto {
  @IsIn(PAYMENT_TYPES)
  type: PaymentTypeValue;

  @IsISO8601()
  paymentDate: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 8)
  bankCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  accountNumber?: string;

  @IsOptional()
  @IsUUID()
  exchangeRateId?: string;

  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsIn(PAYMENT_CURRENCIES)
  amountCurrency: 'USD' | 'EUR' | 'BS';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amountValue: number;
}

export class UpdateOrderPaymentDto {
  @IsOptional()
  @IsIn(PAYMENT_TYPES)
  type?: PaymentTypeValue;

  @IsOptional()
  @IsISO8601()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 8)
  bankCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  accountNumber?: string;

  @IsOptional()
  @IsUUID()
  exchangeRateId?: string;

  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsOptional()
  @IsIn(PAYMENT_CURRENCIES)
  amountCurrency?: 'USD' | 'EUR' | 'BS';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountValue?: number;
}
