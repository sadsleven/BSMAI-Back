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
  'cash_foreign',
  'cash_bs',
  'other',
] as const;
export const PAYMENT_CURRENCIES = ['USD', 'EUR', 'BS'] as const;

export class CreditsReceivablePaymentDto {
  @IsIn(PAYMENT_TYPES)
  type: 'mobile_payment' | 'bank_transfer' | 'cash_foreign' | 'cash_bs' | 'other';

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

export class RegisterCreditCollectionDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Seleccioná al menos una cuenta' })
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  creditIds: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Registrá al menos un cobro' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreditsReceivablePaymentDto)
  payments: CreditsReceivablePaymentDto[];
}

export class QueryCreditsReceivableDto {
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
  @IsIn(['collected', 'uncollected', 'partially_collected', 'overcollected'])
  status?: 'collected' | 'uncollected' | 'partially_collected' | 'overcollected';

  @IsOptional()
  @IsUUID()
  holderId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsIn(['orderNumber', 'createdAt', 'updatedAt'])
  sortBy?: 'orderNumber' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @Matches(/^(ASC|DESC)$/i)
  sortDir?: 'ASC' | 'DESC';
}
