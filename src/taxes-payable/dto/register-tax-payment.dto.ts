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

/**
 * Crear un lote SENIAT con sus obligaciones de retención. Un lote puede agrupar
 * retenciones de varios proveedores (el SENIAT cobra al agente de retención, no
 * al proveedor).
 */
export class CreateTaxBatchDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Agregá al menos una retención' })
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  taxPayableIds: string[];
}

/**
 * Ajuste de UT del lote SENIAT: `taxUnitId` nulo o ausente quita el ajuste;
 * con UUID, el monto a pagar al fisco se recalcula con esa UT.
 */
export class SetTaxBatchAdjustmentDto {
  @IsOptional()
  @IsUUID()
  taxUnitId?: string | null;
}

/** Guardar los datos del comprobante ISLR del lote (N° + fecha de emisión). */
export class SetTaxBatchComprobanteDto {
  @IsString()
  @MaxLength(50)
  comprobanteNumber: string;

  @IsISO8601()
  issueDate: string;
}

/** Agregar/quitar obligaciones de un lote existente. */
export class MutateTaxBatchObligationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  taxPayableIds: string[];
}

/** Registrar uno o más pagos al SENIAT sobre un lote (id por path). */
export class RegisterTaxPaymentDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Registrá al menos un pago' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaxPayablePaymentDto)
  payments: TaxPayablePaymentDto[];
}

/** Pendientes (obligaciones de retención sin lote). */
export class QueryPendingTaxDto {
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

/** Listado de lotes SENIAT. */
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
  @IsIn(['taxBatchNumber', 'createdAt', 'updatedAt'])
  sortBy?: 'taxBatchNumber' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @Matches(/^(ASC|DESC)$/i)
  sortDir?: 'ASC' | 'DESC';
}
