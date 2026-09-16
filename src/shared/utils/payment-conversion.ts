import { BadRequestException } from '@nestjs/common';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';

export type PaymentCurrency = 'USD' | 'EUR' | 'BS';

/** Zona horaria de negocio: las tasas BCV son "del día" en Venezuela. */
const BUSINESS_TZ = 'America/Caracas';

export interface PaymentToConvert {
  amountValue: number;
  amountCurrency: PaymentCurrency;
  /**
   * Tasa snapshot del pago. EUR → rate EUR/Bs. BS → rate USD/Bs (la misma
   * que `usdExchangeRateId`). USD → opcional.
   */
  exchangeRateId?: string | null;
}

export interface UsdConversionContext {
  /**
   * Tasa USD/Bs de referencia para pagos en BS. Preferí pasar
   * `order.billingExchangeRateId` si la orden ya está facturada; sino, la
   * última activa de USD. Para pagos en EUR es sólo el fallback: el cruce
   * EUR→Bs→USD usa la tasa USD/Bs del mismo día que la tasa EUR del pago
   * (ver `resolveUsdRateForEur`).
   */
  usdExchangeRateId?: string | null;
}

/**
 * Convierte un pago a USD usando las tasas referenciadas.
 * - USD: devuelve `amountValue`.
 * - BS: necesita `usdRate` → `amountValue / usdRate.amountBs`.
 * - EUR: necesita `eurRate` (snapshot del pago) → Bs con ella, y de Bs a USD
 *   con la tasa USD/Bs del MISMO DÍA que la tasa EUR (o la más cercana; si
 *   no hay ninguna, `ctx.usdExchangeRateId` / última activa).
 *
 * Throws BadRequestException si faltan tasas requeridas.
 */
export async function computeAmountInUsd(
  payment: PaymentToConvert,
  ratesRepo: Repository<ExchangeRate>,
  ctx: UsdConversionContext,
): Promise<number> {
  const v = Number(payment.amountValue);
  if (!Number.isFinite(v) || v <= 0) {
    throw new BadRequestException('Monto del pago debe ser > 0');
  }
  if (payment.amountCurrency === 'USD') return v;

  if (payment.amountCurrency === 'BS') {
    const usdRate = await resolveUsdRate(ratesRepo, ctx.usdExchangeRateId);
    return roundUsd(v / positiveBs(usdRate, 'USD'));
  }

  // EUR: rate EUR/Bs del pago + rate USD/Bs del mismo día de esa tasa EUR.
  const eurRate = await loadEurRate(ratesRepo, payment.exchangeRateId);
  const usdRate = await resolveUsdRateForEur(
    ratesRepo,
    eurRate,
    ctx.usdExchangeRateId,
  );
  return roundUsd((v * positiveBs(eurRate, 'EUR')) / positiveBs(usdRate, 'USD'));
}

/** Carga y valida la tasa EUR/Bs snapshot de un pago en EUR. */
async function loadEurRate(
  ratesRepo: Repository<ExchangeRate>,
  exchangeRateId?: string | null,
): Promise<ExchangeRate> {
  if (!exchangeRateId) {
    throw new BadRequestException(
      'Pago en EUR requiere exchangeRateId con tasa EUR/Bs',
    );
  }
  const eurRate = await ratesRepo.findOne({ where: { id: exchangeRateId } });
  if (!eurRate) throw new BadRequestException('Tasa EUR no encontrada');
  if (eurRate.currency !== 'EUR') {
    throw new BadRequestException(
      'exchangeRateId del pago EUR debe ser de tipo EUR',
    );
  }
  return eurRate;
}

function positiveBs(rate: ExchangeRate, label: 'USD' | 'EUR'): number {
  const bs = Number(rate.amountBs);
  if (!Number.isFinite(bs) || bs <= 0) {
    throw new BadRequestException(`Tasa ${label} inválida (amountBs ≤ 0)`);
  }
  return bs;
}

/** `YYYY-MM-DD` de un instante en la zona de negocio (America/Caracas). */
export function businessDayKey(d: Date): string {
  // en-CA formatea como YYYY-MM-DD.
  return d.toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ });
}

/**
 * Elige la tasa USD/Bs con la que cruzar una tasa EUR/Bs: la del MISMO DÍA
 * (Caracas) que `eurEffectiveDate`; si hay varias, la más cercana en hora.
 * Si ninguna es del mismo día, la más cercana en el tiempo (antes o después).
 * `null` si no hay candidatas válidas. Regla pura, espejo de la del FE.
 */
export function pickUsdRateForEur(
  eurEffectiveDate: string | Date,
  candidates: Array<ExchangeRate | null | undefined>,
): ExchangeRate | null {
  const target = new Date(eurEffectiveDate);
  if (Number.isNaN(target.getTime())) return null;
  const dayKey = businessDayKey(target);
  const scored = candidates
    .filter((r): r is ExchangeRate => !!r && r.currency === 'USD')
    .map((r) => {
      const t = new Date(r.effectiveDate).getTime();
      return {
        rate: r,
        delta: Number.isNaN(t) ? Infinity : Math.abs(t - target.getTime()),
        sameDay: !Number.isNaN(t) && businessDayKey(new Date(t)) === dayKey,
      };
    })
    .filter((s) => s.delta !== Infinity);
  if (scored.length === 0) return null;
  const sameDay = scored.filter((s) => s.sameDay);
  const pool = sameDay.length ? sameDay : scored;
  pool.sort((a, b) => a.delta - b.delta);
  return pool[0].rate;
}

/**
 * Tasa USD/Bs para cruzar un pago en EUR: la activa del mismo día (Caracas)
 * que la tasa EUR; si no hay, la activa más cercana (anterior o posterior);
 * si no hay ninguna USD activa, cae a `resolveUsdRate(fallbackUsdRateId)`.
 *
 * Basta con la vecina anterior-o-igual y la vecina posterior: cualquier tasa
 * del mismo día queda necesariamente entre una de ellas y la tasa EUR.
 */
export async function resolveUsdRateForEur(
  ratesRepo: Repository<ExchangeRate>,
  eurRate: Pick<ExchangeRate, 'effectiveDate'>,
  fallbackUsdRateId?: string | null,
): Promise<ExchangeRate> {
  const at = new Date(eurRate.effectiveDate);
  if (!Number.isNaN(at.getTime())) {
    const iso = at.toISOString();
    const [before, after] = await Promise.all([
      ratesRepo.findOne({
        where: {
          currency: 'USD',
          isActive: true,
          effectiveDate: LessThanOrEqual(iso),
        },
        order: { effectiveDate: 'DESC', createdAt: 'DESC' },
      }),
      ratesRepo.findOne({
        where: {
          currency: 'USD',
          isActive: true,
          effectiveDate: MoreThan(iso),
        },
        order: { effectiveDate: 'ASC', createdAt: 'DESC' },
      }),
    ]);
    const picked = pickUsdRateForEur(at, [before, after]);
    if (picked) return picked;
  }
  return resolveUsdRate(ratesRepo, fallbackUsdRateId);
}

/**
 * Resuelve la tasa USD/Bs:
 *  - Si `usdExchangeRateId` viene, la usa (valida currency='USD').
 *  - Sino, busca la última `ExchangeRate currency='USD'` por `effectiveDate DESC`.
 */
export async function resolveUsdRate(
  ratesRepo: Repository<ExchangeRate>,
  usdExchangeRateId?: string | null,
): Promise<ExchangeRate> {
  if (usdExchangeRateId) {
    const rate = await ratesRepo.findOne({ where: { id: usdExchangeRateId } });
    if (!rate) throw new BadRequestException('Tasa USD no encontrada');
    if (rate.currency !== 'USD') {
      throw new BadRequestException(
        'billingExchangeRateId debe ser de tipo USD',
      );
    }
    return rate;
  }
  const latest = await ratesRepo.findOne({
    where: { currency: 'USD' },
    order: { effectiveDate: 'DESC' },
  });
  if (!latest) {
    throw new BadRequestException(
      'No hay tasa de cambio USD activa. Cargá una en /exchange-rates antes de continuar.',
    );
  }
  return latest;
}

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Convierte un pago a Bolívares usando las tasas referenciadas.
 *  - BS: devuelve `amountValue`.
 *  - USD: necesita `usdRate` → `amountValue × usdRate.amountBs`.
 *  - EUR: necesita `eurRate` (snapshot del pago) → `amountValue × eurRate.amountBs`.
 *
 * Throws BadRequestException si faltan tasas requeridas.
 */
export async function computeAmountInBs(
  payment: PaymentToConvert,
  ratesRepo: Repository<ExchangeRate>,
  ctx: UsdConversionContext,
): Promise<number> {
  const v = Number(payment.amountValue);
  if (!Number.isFinite(v) || v <= 0) {
    throw new BadRequestException('Monto del pago debe ser > 0');
  }
  if (payment.amountCurrency === 'BS') return roundBs(v);

  if (payment.amountCurrency === 'USD') {
    const usdRate = await resolveUsdRate(ratesRepo, ctx.usdExchangeRateId);
    const usdRateBs = Number(usdRate.amountBs);
    if (!Number.isFinite(usdRateBs) || usdRateBs <= 0) {
      throw new BadRequestException('Tasa USD inválida (amountBs ≤ 0)');
    }
    return roundBs(v * usdRateBs);
  }

  // EUR
  if (!payment.exchangeRateId) {
    throw new BadRequestException(
      'Pago en EUR requiere exchangeRateId con tasa EUR/Bs',
    );
  }
  const eurRate = await ratesRepo.findOne({
    where: { id: payment.exchangeRateId },
  });
  if (!eurRate) throw new BadRequestException('Tasa EUR no encontrada');
  if (eurRate.currency !== 'EUR') {
    throw new BadRequestException(
      'exchangeRateId del pago EUR debe ser de tipo EUR',
    );
  }
  const eurRateBs = Number(eurRate.amountBs);
  if (!Number.isFinite(eurRateBs) || eurRateBs <= 0) {
    throw new BadRequestException('Tasa EUR inválida (amountBs ≤ 0)');
  }
  return roundBs(v * eurRateBs);
}

function roundBs(n: number): number {
  return Math.round(n * 100) / 100;
}
