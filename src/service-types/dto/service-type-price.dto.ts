import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateIf,
} from 'class-validator';

/**
 * Item del array `prices` enviado al crear/actualizar un service type.
 * `insuranceId` opcional → la fila representa el precio "Particular".
 * Cualquiera de los dos montos puede omitirse.
 */
export class ServiceTypePriceDto {
  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  @IsOptional()
  @ValidateIf((o) => o.priceUsd !== undefined && o.priceUsd !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceUsd?: number;

  @IsOptional()
  @ValidateIf((o) => o.priceEur !== undefined && o.priceEur !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceEur?: number;
}
