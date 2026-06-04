import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const PAYMENT_TYPES = [
  'mobile_payment',
  'bank_transfer',
  'cash_usd',
  'cash_eur',
  'cash_bs',
  'other',
] as const;
export const PAYMENT_CURRENCIES = ['USD', 'EUR', 'BS'] as const;

export class TaxPayablePaymentDto {
  @IsIn(PAYMENT_TYPES)
  type: 'mobile_payment' | 'bank_transfer' | 'cash_usd' | 'cash_eur' | 'cash_bs' | 'other';

  @IsISO8601()
  paymentDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  bankCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  accountNumber?: string;

  @IsOptional()
  @IsUUID()
  exchangeRateId?: string;

  @IsIn(PAYMENT_CURRENCIES)
  amountCurrency: 'USD' | 'EUR' | 'BS';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amountValue: number;
}

export class RegisterTaxPaymentDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Seleccioná al menos una cuenta' })
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  taxPayableIds: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Registrá al menos un pago' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaxPayablePaymentDto)
  payments: TaxPayablePaymentDto[];
}

export class QueryTaxesPayableDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['paid', 'unpaid', 'partially_paid'])
  status?: 'paid' | 'unpaid' | 'partially_paid';

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  careCenterId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsIn(['taxPayableNumber', 'taxAmountBs', 'grossAmountBs', 'createdAt', 'updatedAt'])
  sortBy?: 'taxPayableNumber' | 'taxAmountBs' | 'grossAmountBs' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @Matches(/^(ASC|DESC)$/i)
  sortDir?: 'ASC' | 'DESC';
}
