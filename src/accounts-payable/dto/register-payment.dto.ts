import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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

export class AccountsPayablePaymentDto {
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

/** Crear un lote de Cuentas por pagar para UN proveedor, con sus órdenes internas. */
export class CreateAccountsPayableBatchDto {
  @IsIn(['doctor', 'care_center'])
  recipientType: 'doctor' | 'care_center';

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  careCenterId?: string;

  /** UT para la retención SENIAT del lote. Sin enviar = UT vigente. */
  @IsOptional()
  @IsUUID()
  taxUnitId?: string;

  /** ¿Descontar la retención de ISLR? Sin enviar = `true`. */
  @IsOptional()
  @IsBoolean()
  applyRetention?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos una orden interna' })
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  internalOrderIds: string[];
}

/** Cambiar la UT del cálculo de retención de un lote existente. */
export class SetPayableTaxUnitDto {
  @IsUUID()
  taxUnitId: string;
}

/** Activar/desactivar la retención de ISLR de un lote existente. */
export class SetPayableRetentionDto {
  @IsBoolean()
  applyRetention: boolean;
}

/** Agregar/quitar órdenes internas de un lote existente (mismo proveedor). */
export class MutateAccountsPayableOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  internalOrderIds: string[];
}

/** Registrar uno o más pagos sobre un lote (id por path). */
export class RegisterPaymentDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Registrá al menos un pago' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AccountsPayablePaymentDto)
  payments: AccountsPayablePaymentDto[];
}

/** Pendientes (órdenes internas facturadas, sin lote). */
export class QueryPendingPayableDto {
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
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  careCenterId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

/** Listado de lotes. */
export class QueryAccountsPayableDto {
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
  @IsIn(['payableNumber', 'createdAt', 'updatedAt'])
  sortBy?: 'payableNumber' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @Matches(/^(ASC|DESC)$/i)
  sortDir?: 'ASC' | 'DESC';
}
