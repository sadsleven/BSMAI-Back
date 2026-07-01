import {
  casheaCommissionForOrder,
  casheaFinancingForOrder,
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
    it('comisión = total × commissionRate', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '100.00',
        casheaFirstInstallmentAmount: '30.00',
        casheaCommissionRate: '0.0464',
        casheaFinancingRate: '0.0620',
      });
      // 100 × 0.0464 = 4.64 (la inicial NO afecta la comisión)
      expect(casheaCommissionForOrder(order)).toBe(4.64);
    });

    it('redondea a 2 decimales (mitad-arriba exacto)', () => {
      // 0.25 × 6% = 0.015 → debe redondear a 0.02 (toFixed daría 0.01).
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '0.25',
        casheaFirstInstallmentAmount: '0.00',
        casheaCommissionRate: '0.0600',
        casheaFinancingRate: '0.0000',
      });
      expect(casheaCommissionForOrder(order)).toBe(0.02);
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
        casheaCommissionRate: null,
        casheaFinancingRate: null,
      });
      expect(casheaCommissionForOrder(order)).toBe(0);
    });
  });

  describe('casheaFinancingForOrder', () => {
    it('financiamiento = (total − inicial) × financingRate', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '100.00',
        casheaFirstInstallmentAmount: '30.00',
        casheaCommissionRate: '0.0464',
        casheaFinancingRate: '0.0620',
      });
      // restante 70 × 0.062 = 4.34
      expect(casheaFinancingForOrder(order)).toBe(4.34);
    });

    it('inicial = total → restante 0 → financiamiento 0', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '100.00',
        casheaFirstInstallmentAmount: '100.00',
        casheaCommissionRate: '0.0464',
        casheaFinancingRate: '0.0620',
      });
      expect(casheaFinancingForOrder(order)).toBe(0);
    });

    it('orden no-Cashea → 0', () => {
      const order = makeOrder({ type: 'credit', priceAmount: '100.00' });
      expect(casheaFinancingForOrder(order)).toBe(0);
    });
  });

  describe('targetUsdForOrder', () => {
    it('Cashea → restante − comisión − financiamiento (resta la inicial)', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '100.00',
        casheaFirstInstallmentAmount: '30.00',
        casheaCommissionRate: '0.0464',
        casheaFinancingRate: '0.0620',
      });
      // restante 70 − comisión 4.64 − financiamiento 4.34 = 61.02
      expect(targetUsdForOrder(order)).toBe(61.02);
    });

    it('medio-centavo: redondeo mitad-arriba exacto (no drift toFixed)', () => {
      const order = makeOrder({
        type: 'cashea',
        priceAmount: '0.25',
        casheaFirstInstallmentAmount: '0.00',
        casheaCommissionRate: '0.0600',
        casheaFinancingRate: '0.0000',
      });
      // restante 0.25 − comisión 0.02 (0.015 ↑) − 0 = 0.23
      expect(targetUsdForOrder(order)).toBe(0.23);
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
