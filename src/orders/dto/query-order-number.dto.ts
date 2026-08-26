import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Consulta de disponibilidad de números de orden para el Paso 1.
 *
 *  - `number`: número a verificar. Sin él, la respuesta sólo trae la sugerencia
 *    (el mayor en uso + 1), que es el valor por defecto del formulario.
 *  - `count`: proveedores distintos de la orden. Cada uno consume un número
 *    consecutivo (una orden interna del Paso 2), así que se verifica el bloque
 *    `[number, number + count - 1]` completo.
 *  - `orderId`: excluye los números que ya tiene esa orden (renumerar borrador).
 */
export class QueryOrderNumberDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de orden debe ser un entero' })
  @Min(1, { message: 'El número de orden debe ser mayor o igual a 1' })
  number?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;
}
