import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';

export class CreateTaxUnitDto {
  /**
   * Monto en bolívares de 1 UT. Acepta hasta 2 decimales.
   * Recibe número (el FE convierte 43,00 → 43.00).
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
