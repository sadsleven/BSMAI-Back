import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const DOCTOR_AMOUNT_CURRENCIES = ['USD', 'EUR', 'BS'] as const;
export const PROVIDER_TYPES_FOR_BILLING = ['doctor', 'care_center'] as const;

/** Paso 2 — Atención del paciente. */
export class AttendOrderDto {
  @IsBoolean()
  attended: boolean;

  @IsOptional()
  @IsISO8601()
  attendedAt?: string;
}

/** Paso 3 — Informe médico y estudios. */
export class ReportOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  otherStudies?: string | null;
}

/** Pago a un proveedor específico de la orden. */
export class BillingProviderDto {
  @IsIn(PROVIDER_TYPES_FOR_BILLING)
  providerType: 'doctor' | 'care_center';

  @ValidateIf((o) => o.providerType === 'doctor')
  @IsUUID('4')
  doctorId?: string;

  @ValidateIf((o) => o.providerType === 'care_center')
  @IsUUID('4')
  careCenterId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsIn(DOCTOR_AMOUNT_CURRENCIES)
  currency: 'USD' | 'EUR' | 'BS';
}

/**
 * Paso 4 — Facturación y liquidación.
 *
 * Acepta una lista `providers[]` con un pago por proveedor distinto que
 * participa en la orden. La tasa de cambio (`billingExchangeRateId`) es única
 * por orden — todos los provider amounts se convierten con ella si están en BS.
 *
 * El antiguo `doctorAmount/doctorAmountCurrency` queda como total agregado
 * (no enviado por el cliente, derivado en service).
 */
export class BillingOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Asigná al menos un pago a un proveedor' })
  @ValidateNested({ each: true })
  @Type(() => BillingProviderDto)
  providers: BillingProviderDto[];

  @IsUUID()
  billingExchangeRateId: string;
}
