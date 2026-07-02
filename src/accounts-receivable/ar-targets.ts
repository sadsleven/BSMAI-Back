import { Order } from '../orders/entities/order.entity';

/**
 * Comisión Cashea (USD) snapshot de una orden = total × commissionRate.
 * 0 si la orden no es Cashea o le falta el snapshot de tasa.
 *
 * Cálculo exacto en centavos enteros (redondeo mitad-arriba) para evitar el
 * drift de punto flotante de `Number.toFixed`.
 */
export function casheaCommissionForOrder(order: Order): number {
  if (order.type !== 'cashea') return 0;
  const price = Number(order.priceAmount);
  if (!Number.isFinite(price)) return 0;
  const rate = Number(order.casheaCommissionRate) || 0;
  const priceCents = Math.round(price * 100);
  const rc = Math.round(rate * 10000);
  return Math.round((priceCents * rc) / 10000) / 100;
}

/**
 * Financiamiento Cashea (USD) snapshot de una orden = restante × financingRate,
 * donde restante = total − inicial. 0 si no es Cashea o le falta el snapshot.
 *
 * Cálculo exacto en centavos enteros (redondeo mitad-arriba).
 */
export function casheaFinancingForOrder(order: Order): number {
  if (order.type !== 'cashea') return 0;
  const price = Number(order.priceAmount);
  if (!Number.isFinite(price)) return 0;
  const initial = Number(order.casheaFirstInstallmentAmount) || 0;
  const rate = Number(order.casheaFinancingRate) || 0;
  const remainingCents = Math.max(
    0,
    Math.round(price * 100) - Math.round(initial * 100),
  );
  const rf = Math.round(rate * 10000);
  return Math.round((remainingCents * rf) / 10000) / 100;
}

/**
 * Target USD que el comercio espera cobrar por una orden. Para órdenes Cashea:
 *   restante = total − inicial   (la inicial la cobró el comercio del titular en
 *                                 el Paso 1, no entra en la cuenta por cobrar)
 *   target   = restante − comisión − financiamiento
 * Resto de tipos esperan priceAmount. No aplica a órdenes `useFixedRate=true`.
 */
export function targetUsdForOrder(order: Order): number {
  const price = Number(order.priceAmount);
  if (!Number.isFinite(price)) return 0;
  if (order.type === 'cashea') {
    const initial = Number(order.casheaFirstInstallmentAmount) || 0;
    const remaining = Math.max(0, +(price - initial).toFixed(2));
    const commission = casheaCommissionForOrder(order);
    const financing = casheaFinancingForOrder(order);
    return Math.max(0, +(remaining - commission - financing).toFixed(2));
  }
  return price;
}

/**
 * Target Bs para órdenes con tasa fija. Devuelve null si la orden no está en
 * modo tasa fija. Se calcula `priceAmount × fixedExchangeRate.amountBs`.
 */
export function targetBsForOrder(order: Order): number | null {
  if (!order.useFixedRate || !order.fixedExchangeRate) return null;
  const price = Number(order.priceAmount);
  const rateBs = Number(order.fixedExchangeRate.amountBs);
  if (!Number.isFinite(price) || !Number.isFinite(rateBs)) return null;
  return +(price * rateBs).toFixed(2);
}
