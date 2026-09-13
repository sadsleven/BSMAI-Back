import { IsNumber, IsPositive, IsUUID, Max } from 'class-validator';

/**
 * Fila de precio de un Tipo de Servicio para un actor (Seguro, Doctor, Centro).
 * Sólo USD, obligatorio y > 0.
 */
export class ServicePriceDto {
  @IsUUID()
  serviceTypeId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio USD debe ser mayor a 0' })
  @Max(99999999.99)
  priceUsd: number;
}
