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
  Min,
  ValidateIf,
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
  type:
    | 'mobile_payment'
    | 'bank_transfer'
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

  @IsIn(PAYMENT_CURRENCIES)
  amountCurrency: 'USD' | 'EUR' | 'BS';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amountValue: number;
}

/**
 * ABONO: una porción del bruto del lote (`coveredUsd`) pagada a UNA tasa, con
 * SU retención y las filas de pago que entregan el neto al proveedor.
 */
export class AccountsPayableSettlementDto {
  /** Fecha del abono: define el período fiscal de su retención. */
  @IsISO8601()
  settlementDate: string;

  /** USD del bruto del lote que cubre este abono (≤ el saldo pendiente). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  coveredUsd: number;

  /** Tasa USD/Bs a la que se pagó esta porción. */
  @IsUUID()
  exchangeRateId: string;

  /** UT para la retención del abono. Sin enviar = la del lote / la vigente. */
  @IsOptional()
  @IsUUID()
  taxUnitId?: string;

  /**
   * Monto manual de la retención del abono en Bs. Sin enviar (o `null`) = el
   * cálculo prorrateado. Se ignora si el lote no aplica retención.
   */
  @IsOptional()
  @ValidateIf(
    (o: AccountsPayableSettlementDto) => o.customRetentionBs !== null,
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  customRetentionBs?: number | null;

  /** Filas con las que se entregó el neto: deben sumarlo exactamente. */
  @IsArray()
  @ArrayMinSize(1, { message: 'Registrá al menos una forma de pago' })
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AccountsPayablePaymentDto)
  payments: AccountsPayablePaymentDto[];
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

  /**
   * Tasa de pago USD/Bs por defecto del lote (la que se propone a cada abono).
   * Sin enviar = tasa USD vigente.
   */
  @IsOptional()
  @IsUUID()
  exchangeRateId?: string;

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

/** Cambiar la tasa de pago USD/Bs por defecto de un lote existente. */
export class SetPayableExchangeRateDto {
  @IsUUID()
  exchangeRateId: string;
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
