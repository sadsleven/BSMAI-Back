import { Order } from '../orders/entities/order.entity';

/**
 * Comisión Cashea (USD) snapshot de una orden = primeraCuota × firstRate +
 * total × totalRate. 0 si la orden no es Cashea o le faltan snapshots.
 *
 * Cálculo exacto en centavos enteros (redondeo mitad-arriba) para evitar el
 * drift de punto flotante de `Number.toFixed`.
 */
export function casheaCommissionForOrder(order: Order): number {
  if (order.type !== 'cashea') return 0;
  const price = Number(order.priceAmount);
  if (!Number.isFinite(price)) return 0;
  const firstAmount = Number(order.casheaFirstInstallmentAmount) || 0;
  const firstRate = Number(order.casheaFirstInstallmentRate) || 0;
  const totalRate = Number(order.casheaTotalRate) || 0;
  const firstCents = Math.round(firstAmount * 100);
  const priceCents = Math.round(price * 100);
  const r1 = Math.round(firstRate * 10000);
  const r2 = Math.round(totalRate * 10000);
  const commissionCents = Math.round((firstCents * r1 + priceCents * r2) / 10000);
  return commissionCents / 100;
}

/**
 * Target USD que el comercio espera cobrar por una orden. Para órdenes Cashea
 * descuenta la comisión snapshot Y la cuota inicial (cobrada del titular en el
 * Paso 1 como pago real), porque la cuenta por cobrar Cashea sólo cubre el resto
 * financiado por Cashea — el inicial ya está cobrado y no se cuenta de nuevo.
 * Resto de tipos esperan priceAmount. No aplica a órdenes `useFixedRate=true`.
 */
export function targetUsdForOrder(order: Order): number {
  const price = Number(order.priceAmount);
  if (!Number.isFinite(price)) return 0;
  if (order.type === 'cashea') {
    const initial = Number(order.casheaFirstInstallmentAmount) || 0;
    return Math.max(0, +(price - casheaCommissionForOrder(order) - initial).toFixed(2));
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
