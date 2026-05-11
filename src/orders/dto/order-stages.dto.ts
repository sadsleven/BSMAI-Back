import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const DOCTOR_AMOUNT_CURRENCIES = ['USD', 'EUR', 'BS'] as const;

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

/** Paso 4 — Facturación y liquidación. */
export class BillingOrderDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  doctorAmount: number;

  @IsIn(DOCTOR_AMOUNT_CURRENCIES)
  doctorAmountCurrency: 'USD' | 'EUR' | 'BS';

  @IsUUID()
  billingExchangeRateId: string;
}
