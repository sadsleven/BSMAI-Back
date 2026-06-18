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
  'bank_transfer_usd',
  'card',
  'cash_usd',
  'cash_eur',
  'cash_bs',
  'other',
] as const;
export const PAYMENT_CURRENCIES = ['USD', 'EUR', 'BS'] as const;

export class AccountsReceivablePaymentDto {
  @IsIn(PAYMENT_TYPES)
  type:
    | 'mobile_payment'
    | 'bank_transfer'
    | 'bank_transfer_usd'
    | 'card'
    | 'cash_usd'
    | 'cash_eur'
    | 'cash_bs'
    | 'other';

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

  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsIn(PAYMENT_CURRENCIES)
  amountCurrency: 'USD' | 'EUR' | 'BS';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amountValue: number;
}

/** Crear un lote de Cuentas por cobrar para UN deudor, con sus órdenes. */
export class CreateAccountsReceivableBatchDto {
  @IsIn(['insurance', 'holder'])
  debtorType: 'insurance' | 'holder';

  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  @IsOptional()
  @IsUUID()
  holderId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agregá al menos una orden' })
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  orderIds: string[];
}

/** Agregar/quitar órdenes de un lote existente (mismo deudor y modo). */
export class MutateAccountsReceivableOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  orderIds: string[];
}

/** Registrar uno o más cobros sobre un lote (id por path). */
export class RegisterCollectionDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Registrá al menos un cobro' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AccountsReceivablePaymentDto)
  payments: AccountsReceivablePaymentDto[];
}

/** Pendientes (órdenes finalizadas con deudor, sin lote). */
export class QueryPendingReceivableDto {
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
  @IsIn(['insurance', 'holder'])
  debtorType?: 'insurance' | 'holder';

  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  @IsOptional()
  @IsUUID()
  holderId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

/** Listado de lotes. */
export class QueryAccountsReceivableDto {
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
  insuranceId?: string;

  @IsOptional()
  @IsUUID()
  holderId?: string;

  @IsOptional()
  @IsIn(['insurance', 'holder'])
  debtorType?: 'insurance' | 'holder';

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(['receivableNumber', 'createdAt', 'updatedAt'])
  sortBy?: 'receivableNumber' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @Matches(/^(ASC|DESC)$/i)
  sortDir?: 'ASC' | 'DESC';
}
