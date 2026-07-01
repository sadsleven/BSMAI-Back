import { IsNumber, Max, Min } from 'class-validator';

/**
 * Configuración Cashea, expresada como fracciones (0..0.5):
 *  - `commissionRate`: % sobre el TOTAL de la venta (comisión). Ej. 0.0464 = 4.64%.
 *  - `financingRate`: % sobre el RESTANTE (total − inicial) — financiamiento.
 *    Ej. 0.062 = 6.2%.
 *
 * Tope superior 50% por tramo como guardrail anti-error.
 */
export class UpdateCasheaCommissionDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(0.5)
  commissionRate: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(0.5)
  financingRate: number;
}
