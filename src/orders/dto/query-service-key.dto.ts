import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Consulta de disponibilidad de una clave de servicio (Paso 1, órdenes de
 * seguro). La clave es única entre órdenes vivas y no se reutiliza: sólo queda
 * libre si la orden que la tenía fue cancelada.
 *
 *  - `key`: clave a verificar (sin ella la respuesta viene vacía).
 *  - `orderId`: excluye la propia orden (al editarla su clave no sale "en uso").
 */
export class QueryServiceKeyDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(30)
  key?: string;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;
}
