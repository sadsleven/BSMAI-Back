import { IsNumber, Max, Min } from 'class-validator';

/**
 * Comisión Cashea expresada como fracción (0..0.5). Ej. 0.10 = 10%. Tope
 * superior 50% como guardrail para evitar configurar valores absurdos por
 * error.
 */
export class UpdateCasheaCommissionDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(0.5)
  commissionRate: number;
}
