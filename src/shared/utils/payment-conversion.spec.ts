import { ExchangeRate } from '../../exchange-rates/entities/exchange-rate.entity';
import { businessDayKey, pickUsdRateForEur } from './payment-conversion';

function usd(id: string, effectiveDate: string, amountBs = '100'): ExchangeRate {
  return {
    id,
    currency: 'USD',
    amountBs,
    effectiveDate,
    isActive: true,
  } as ExchangeRate;
}

describe('businessDayKey', () => {
  it('usa el día de America/Caracas (UTC-4), no el de UTC', () => {
    // 01:30Z del 18 = 21:30 del 17 en Caracas.
    expect(businessDayKey(new Date('2026-08-18T01:30:00Z'))).toBe('2026-08-17');
    expect(businessDayKey(new Date('2026-08-18T04:00:00Z'))).toBe('2026-08-18');
  });
});

describe('pickUsdRateForEur', () => {
  // Tasa EUR publicada el 17/08 a las 09:00 Caracas (13:00Z).
  const eurAt = '2026-08-17T13:00:00Z';

  it('prefiere la tasa USD del mismo día aunque otra esté más cerca en horas', () => {
    const sameDayFar = usd('same', '2026-08-17T12:05:00Z'); // 08:05 Caracas
    const nextDayNear = usd('next', '2026-08-18T04:10:00Z'); // 00:10 Caracas del 18
    // eurAt real: 23:30 Caracas del 17 → 03:30Z del 18.
    const lateEur = '2026-08-18T03:30:00Z';
    expect(pickUsdRateForEur(lateEur, [sameDayFar, nextDayNear])?.id).toBe('same');
  });

  it('entre varias del mismo día elige la más cercana en hora', () => {
    const a = usd('a', '2026-08-17T11:00:00Z');
    const b = usd('b', '2026-08-17T13:30:00Z');
    expect(pickUsdRateForEur(eurAt, [a, b])?.id).toBe('b');
  });

  it('sin tasa del mismo día elige la más cercana (anterior o posterior)', () => {
    const before = usd('before', '2026-08-14T13:00:00Z');
    const after = usd('after', '2026-08-19T13:00:00Z');
    expect(pickUsdRateForEur(eurAt, [before, after])?.id).toBe('after');
    const nearerBefore = usd('nb', '2026-08-16T13:00:00Z');
    expect(pickUsdRateForEur(eurAt, [nearerBefore, after])?.id).toBe('nb');
  });

  it('ignora nulos, no-USD y fechas inválidas; null si no queda nada', () => {
    const eur = { ...usd('e', eurAt), currency: 'EUR' } as ExchangeRate;
    const bad = usd('bad', 'not-a-date');
    expect(pickUsdRateForEur(eurAt, [null, undefined, eur, bad])).toBeNull();
    expect(pickUsdRateForEur('garbage', [usd('x', eurAt)])).toBeNull();
  });
});
