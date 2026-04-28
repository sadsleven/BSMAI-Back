import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { CURRENCIES, Currency } from '../entities/exchange-rate.entity';

export class CreateExchangeRateDto {
  @IsIn(CURRENCIES, { message: 'La moneda debe ser USD o EUR' })
  currency: Currency;

  /**
   * Monto en bolívares por 1 unidad. Acepta hasta 2 decimales.
   * Recibe número (no string formateado VE) — el FE convierte 485,22 → 485.22.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Máximo 2 decimales' })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  @Max(999_999_999.99, { message: 'Monto excede el máximo permitido' })
  amountBs: number;

  @IsDateString({}, { message: 'Fecha efectiva inválida' })
  effectiveDate: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
