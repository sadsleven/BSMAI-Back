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

/**
 * Porción indexada (USD) de una orden en modo tasa fija: Σ precio snapshot
 * (`order_service_pricing`, kind='insurance') × cantidad de los STs marcados
 * `isIndexed`. Requiere `orderServiceTypes` y `servicePricing` cargados; 0 si
 * faltan o la orden no es tasa fija. Cap al `priceAmount` de la orden.
 */
export function indexedPortionUsd(order: Order): number {
  if (!order.useFixedRate) return 0;
  const unitBySt = new Map<string, number>();
  for (const p of order.servicePricing ?? []) {
    if (p.kind !== 'insurance') continue;
    const n = Number(p.priceUsd);
    if (Number.isFinite(n)) unitBySt.set(p.serviceTypeId, n);
  }
  let cents = 0;
  for (const ost of order.orderServiceTypes ?? []) {
    if (!ost.isIndexed) continue;
    const unit = unitBySt.get(ost.serviceTypeId);
    if (unit == null) continue;
    const qty = Math.max(1, Math.trunc(ost.quantity ?? 1));
    cents += Math.round(unit * 100) * qty;
  }
  const price = Number(order.priceAmount);
  const priceCents = Number.isFinite(price) ? Math.round(price * 100) : cents;
  return Math.min(cents, Math.max(0, priceCents)) / 100;
}

/**
 * Split de una orden tasa fija en porción fija (STs no indexados, cobra en Bs
 * a la tasa de la orden) + porción indexada (STs indexados, cobra en USD a la
 * tasa del día del cobro). `fixedUsd + indexedUsd = priceAmount` exacto (la
 * porción fija absorbe el redondeo).
 */
export function splitOrderPortionsUsd(order: Order): {
  fixedUsd: number;
  indexedUsd: number;
} {
  const price = Number(order.priceAmount) || 0;
  const indexedUsd = indexedPortionUsd(order);
  const fixedUsd = Math.max(0, +(price - indexedUsd).toFixed(2));
  return { fixedUsd, indexedUsd };
}

/**
 * Target Bs de una porción (USD × tasa fija de la orden). Null si la orden no
 * está en modo tasa fija o no tiene tasa snapshot.
 */
export function targetBsForPortion(order: Order, portionUsd: number): number | null {
  if (!order.useFixedRate || !order.fixedExchangeRate) return null;
  const rateBs = Number(order.fixedExchangeRate.amountBs);
  if (!Number.isFinite(rateBs) || !Number.isFinite(portionUsd)) return null;
  return +(portionUsd * rateBs).toFixed(2);
}
