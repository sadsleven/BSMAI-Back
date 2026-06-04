/**
 * Retención de ISLR sobre honorarios profesionales no mercantiles
 * (Decreto 1.808, Reglamento Parcial de ISLR en materia de retenciones).
 *
 * Variables del cálculo:
 *  - UT (Unidad Tributaria): valor en Bs. publicado por SENIAT.
 *  - Factor reglamentario: 83,33334.
 *  - Sustraendo PNR = UT × tasa × Factor.
 *  - Umbral PNR: pagas retención sólo si gross > UT × Factor (Bs. 3.583,33 con UT=43).
 *
 * Reglas:
 *  - Persona Jurídica Domiciliada (PJD): tasa 5%, sin sustraendo, sin umbral.
 *  - Persona Natural Residente (PNR): tasa 3%, con sustraendo, umbral aplica.
 *
 * Centros de atención: tratados como PJD (siempre jurídicos).
 */

export const SENIAT_FACTOR = 83.33334;
export const PJD_TAX_RATE = 0.05;
export const PNR_TAX_RATE = 0.03;

export type SeniatPersonType = 'natural' | 'legal_entity';

export interface RetentionInput {
  /** Monto bruto pagado al proveedor, en bolívares (Bs). */
  grossBs: number;
  personType: SeniatPersonType;
  /** Valor de 1 UT en bolívares al momento del cálculo. */
  taxUnitBs: number;
}

export interface RetentionResult {
  /** Tasa aplicada (0.03 o 0.05). */
  taxRate: number;
  /** Sustraendo aplicado en Bs (sólo PNR, sino 0). */
  subtrahendBs: number;
  /** Umbral de aplicación en Bs (sólo PNR, sino 0). */
  thresholdBs: number;
  /** Retención calculada en Bs (≥ 0, redondeada a 2 decimales). */
  taxAmountBs: number;
  /** Indica si la PNR cae bajo el umbral (sin retención). */
  belowThreshold: boolean;
}

/** Sustraendo reglamentario para PNR: UT × 0,03 × 83,33334. */
export function pnrSubtrahend(taxUnitBs: number): number {
  return round2(taxUnitBs * PNR_TAX_RATE * SENIAT_FACTOR);
}

/** Umbral PNR: pagos > UT × 83,33334 generan retención. */
export function pnrThreshold(taxUnitBs: number): number {
  return round2(taxUnitBs * SENIAT_FACTOR);
}

/**
 * Calcula la retención de ISLR según el régimen aplicable.
 *
 * Ejemplos (UT = Bs. 43,00):
 *   calcRetention({grossBs: 10000, personType: 'natural'})    → 192.50
 *   calcRetention({grossBs:  3000, personType: 'natural'})    →   0.00  (bajo umbral)
 *   calcRetention({grossBs: 10000, personType: 'legal_entity'}) → 500.00
 */
export function calcRetention(input: RetentionInput): RetentionResult {
  const gross = Number(input.grossBs) || 0;
  const ut = Number(input.taxUnitBs) || 0;

  if (input.personType === 'legal_entity') {
    return {
      taxRate: PJD_TAX_RATE,
      subtrahendBs: 0,
      thresholdBs: 0,
      taxAmountBs: round2(gross * PJD_TAX_RATE),
      belowThreshold: false,
    };
  }

  // PNR
  const threshold = pnrThreshold(ut);
  const subtrahend = pnrSubtrahend(ut);

  if (gross <= threshold) {
    return {
      taxRate: PNR_TAX_RATE,
      subtrahendBs: subtrahend,
      thresholdBs: threshold,
      taxAmountBs: 0,
      belowThreshold: true,
    };
  }

  const raw = gross * PNR_TAX_RATE - subtrahend;
  return {
    taxRate: PNR_TAX_RATE,
    subtrahendBs: subtrahend,
    thresholdBs: threshold,
    taxAmountBs: Math.max(0, round2(raw)),
    belowThreshold: false,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
