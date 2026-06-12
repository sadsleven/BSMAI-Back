import {
  casheaCommissionForOrder,
  targetUsdForOrder,
  targetBsForOrder,
} from './accounts-receivable.service';
import { Order } from '../orders/entities/order.entity';

/** Helper: arma un Order parcial casteado para probar funciones puras. */
function makeOrder(partial: Partial<Order>): Order {
  return partial as Order;
}

describe('Cashea pricing (funciones puras)', () => {
  describe('casheaCommissionForOrder', () => {
    it('dos tramos: primeraCuota × firstRate + total × totalRate', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '100.00',
        casheaFirstInstallmentAmount: '40.00',
        casheaFirstInstallmentRate: '0.0400',
        casheaTotalRate: '0.0600',
      });
      // 40×0.04 + 100×0.06 = 1.6 + 6 = 7.6
      expect(casheaCommissionForOrder(order)).toBe(7.6);
    });

    it('primera cuota = 0 → sólo aplica el tramo del total', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '100.00',
        casheaFirstInstallmentAmount: '0.00',
        casheaFirstInstallmentRate: '0.0400',
        casheaTotalRate: '0.0600',
      });
      expect(casheaCommissionForOrder(order)).toBe(6);
    });

    it('redondea a 2 decimales', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '33.33',
        casheaFirstInstallmentAmount: '10.00',
        casheaFirstInstallmentRate: '0.0400',
        casheaTotalRate: '0.0600',
      });
      // 10×0.04 + 33.33×0.06 = 0.4 + 1.9998 = 2.3998 → 2.40
      expect(casheaCommissionForOrder(order)).toBe(2.4);
    });

    it('medio-centavo: redondeo mitad-arriba exacto (no drift toFixed)', () => {
      // 0.25 × 6% = 0.015 → debe redondear a 0.02 (toFixed daría 0.01).
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '0.25',
        casheaFirstInstallmentAmount: '0.00',
        casheaFirstInstallmentRate: '0.0400',
        casheaTotalRate: '0.0600',
      });
      expect(casheaCommissionForOrder(order)).toBe(0.02);
      expect(targetUsdForOrder(order)).toBe(0.23);
    });

    it('orden no-Cashea → 0', () => {
      const order = makeOrder({ type: 'cash', priceAmount: '100.00' });
      expect(casheaCommissionForOrder(order)).toBe(0);
    });

    it('Cashea sin snapshots (nulls) → 0', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '100.00',
        casheaFirstInstallmentAmount: null,
        casheaFirstInstallmentRate: null,
        casheaTotalRate: null,
      });
      expect(casheaCommissionForOrder(order)).toBe(0);
    });
  });

  describe('targetUsdForOrder', () => {
    it('Cashea → precio − comisión', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '100.00',
        casheaFirstInstallmentAmount: '40.00',
        casheaFirstInstallmentRate: '0.0400',
        casheaTotalRate: '0.0600',
      });
      expect(targetUsdForOrder(order)).toBe(92.4);
    });

    it('no-Cashea → precio íntegro', () => {
      const order = makeOrder({ type: 'credit', priceAmount: '250.50' });
      expect(targetUsdForOrder(order)).toBe(250.5);
    });

    it('precio inválido → 0', () => {
      const order = makeOrder({ type: 'cash', priceAmount: 'abc' });
      expect(targetUsdForOrder(order)).toBe(0);
    });
  });

  describe('targetBsForOrder', () => {
    it('tasa fija → precio × amountBs', () => {
      const order = makeOrder({
        type: 'insurance',
        priceAmount: '100.00',
        useFixedRate: true,
        fixedExchangeRate: { amountBs: '40.00' } as Order['fixedExchangeRate'],
      });
      expect(targetBsForOrder(order)).toBe(4000);
    });

    it('sin tasa fija → null', () => {
      const order = makeOrder({
        type: 'insurance',
        priceAmount: '100.00',
        useFixedRate: false,
      });
      expect(targetBsForOrder(order)).toBeNull();
    });
  });
});
