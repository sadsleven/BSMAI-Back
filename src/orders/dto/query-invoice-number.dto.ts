import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

/**
 * Consulta de disponibilidad de un N° de factura (Paso 4).
 *
 *  - `number`: número a verificar. Sin él la respuesta sólo trae la sugerencia
 *    (el mayor emitido + 1), que es el valor por defecto del formulario.
 *  - `orderId`: no marca como ocupado el número de la factura VIGENTE de esa
 *    orden (al reabrir el Paso 4 su propio número no debe salir "en uso").
 */
export class QueryInvoiceNumberDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El número de factura debe ser un entero' })
  @Min(1, { message: 'El número de factura debe ser mayor o igual a 1' })
  number?: number;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;
}
