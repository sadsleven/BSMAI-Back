import {
  IsNumber,
  IsPositive,
  IsUUID,
  Max,
} from 'class-validator';

/**
 * Fila de precio de un Tipo de Servicio para un actor (Seguro, Doctor, Centro).
 * Ambos USD y EUR son obligatorios y > 0 — convención de la restructuración de precios.
 */
export class ServicePriceDto {
  @IsUUID()
  serviceTypeId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio USD debe ser mayor a 0' })
  @Max(99999999.99)
  priceUsd: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio EUR debe ser mayor a 0' })
  @Max(99999999.99)
  priceEur: number;
}
