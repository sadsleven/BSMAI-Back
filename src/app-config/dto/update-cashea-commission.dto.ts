import { IsNumber, Max, Min } from 'class-validator';

/**
 * Comisión Cashea en dos tramos, expresada como fracciones (0..0.5):
 *  - `firstInstallmentRate`: % sobre la primera cuota (inicial). Ej. 0.04 = 4%.
 *  - `totalRate`: % sobre el total de la orden. Ej. 0.06 = 6%.
 *
 * Tope superior 50% por tramo como guardrail anti-error.
 */
export class UpdateCasheaCommissionDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(0.5)
  firstInstallmentRate: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(0.5)
  totalRate: number;
}
