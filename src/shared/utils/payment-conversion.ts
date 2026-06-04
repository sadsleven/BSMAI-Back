import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';

export type PaymentCurrency = 'USD' | 'EUR' | 'BS';

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
   * Tasa USD/Bs de referencia. Preferí pasar `order.billingExchangeRateId` si
   * la orden ya está facturada; sino, la última activa de USD.
   */
  usdExchangeRateId?: string | null;
}

/**
 * Convierte un pago a USD usando las tasas referenciadas.
 * - USD: devuelve `amountValue`.
 * - BS: necesita `usdRate` → `amountValue / usdRate.amountBs`.
 * - EUR: necesita `eurRate` (snapshot del pago) y `usdRate` → cross via Bs.
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

  const usdRate = await resolveUsdRate(ratesRepo, ctx.usdExchangeRateId);
  const usdRateBs = Number(usdRate.amountBs);
  if (!Number.isFinite(usdRateBs) || usdRateBs <= 0) {
    throw new BadRequestException('Tasa USD inválida (amountBs ≤ 0)');
  }

  if (payment.amountCurrency === 'BS') {
    return roundUsd(v / usdRateBs);
  }

  // EUR: necesita rate EUR/Bs del pago + rate USD/Bs de referencia.
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
    throw new BadRequestException('exchangeRateId del pago EUR debe ser de tipo EUR');
  }
  const eurRateBs = Number(eurRate.amountBs);
  if (!Number.isFinite(eurRateBs) || eurRateBs <= 0) {
    throw new BadRequestException('Tasa EUR inválida (amountBs ≤ 0)');
  }
  return roundUsd((v * eurRateBs) / usdRateBs);
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
      throw new BadRequestException('billingExchangeRateId debe ser de tipo USD');
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
    throw new BadRequestException('Pago en EUR requiere exchangeRateId con tasa EUR/Bs');
  }
  const eurRate = await ratesRepo.findOne({ where: { id: payment.exchangeRateId } });
  if (!eurRate) throw new BadRequestException('Tasa EUR no encontrada');
  if (eurRate.currency !== 'EUR') {
    throw new BadRequestException('exchangeRateId del pago EUR debe ser de tipo EUR');
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
