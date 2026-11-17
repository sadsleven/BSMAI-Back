/**
 * Matemática de montos del reporte de cuentas por pagar, sin base de datos.
 *
 * El servicio arma las filas con SQL y después delega acá el cálculo de los
 * totales. Separarlo permite probar las reglas de dinero (que es donde se
 * cometen los errores) sin levantar Postgres.
 *
 * Dos monedas con reglas distintas:
 * - **Bolívares**: el neto de un lote se calcula UNA vez sobre su bruto
 *   agregado (la retención ISLR tiene sustraendo y mínimo, así que sumar el
 *   estimado de cada obligación no cuadraría con los pagos registrados).
 * - **Dólares**: el saldo se lleva por lo abonado (`coveredUsd`), que es como
 *   el módulo de cuentas por pagar arrastra la deuda aunque el lote se pague
 *   en varias partes y a tasas distintas.
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Lo mínimo que la matemática necesita de cada obligación. */
export interface PayableObligationRef {
  orderId: string;
  providerType: 'doctor' | 'care_center';
  doctorId: string | null;
  careCenterId: string | null;
  providerName: string | null;
  payableId: string | null;
  payableStatus: string | null;
}

/** Montos ya resueltos de cada obligación (misma posición que las refs). */
export interface PayableRowAmounts {
  grossUsd: number;
  grossBs: number;
  netBs: number;
}

/** Agregados por lote que vienen del SQL. */
export interface PayableLoteMaps {
  /** Σ pagos en Bs de cada lote. */
  paidByPayable: Map<string, number>;
  /** Σ bruto en Bs de cada lote. */
  loteGrossBs: Map<string, number>;
  /** Σ bruto en USD de cada lote. */
  loteGrossUsd: Map<string, number>;
  /** Neto en Bs del lote (bruto − retención real). */
  loteNetBs: Map<string, number>;
  /** Σ USD ya cubiertos por los abonos del lote. */
  loteCoveredUsd: Map<string, number>;
}

export interface PayableSummary {
  /** Firma de índice: el controller devuelve los summary como mapa plano. */
  [key: string]: number;
  count: number;
  grossUsd: number;
  grossBs: number;
  netBs: number;
  paidBs: number;
  pendingBs: number;
}

export interface PayableProviderTotals {
  providerType: 'doctor' | 'care_center';
  providerId: string | null;
  providerName: string;
  ordersCount: number;
  lotesCount: number;
  grossUsd: number;
  grossBs: number;
  netBs: number;
  paidBs: number;
  pendingBs: number;
  paidUsd: number;
  pendingUsd: number;
}

/** Clave de agrupación: el proveedor, no la obligación. */
export function payableProviderKey(r: {
  providerType: string;
  doctorId: string | null;
  careCenterId: string | null;
}): string {
  return r.providerType === 'doctor'
    ? `doctor:${r.doctorId}`
    : `cc:${r.careCenterId}`;
}

/** Summary vacío (sin resultados o usuario sin sucursales). */
export function emptyPayableSummary(): PayableSummary {
  return {
    count: 0,
    grossUsd: 0,
    grossBs: 0,
    netBs: 0,
    paidBs: 0,
    pendingBs: 0,
  };
}

/**
 * Totales globales del reporte.
 *
 * `netBs` y `pendingBs` recorren LOTES únicos (no obligaciones) para no
 * contar la retención de un lote tantas veces como órdenes tenga; las
 * obligaciones sin lote aportan su propio neto estimado y cuentan completas
 * como pendientes.
 */
export function computePayableSummary(
  obligations: Array<Pick<PayableObligationRef, 'payableId' | 'payableStatus'>>,
  ctx: Pick<
    PayableLoteMaps,
    'paidByPayable' | 'loteGrossBs' | 'loteGrossUsd' | 'loteNetBs'
  > & { perObligationRows: PayableRowAmounts[] },
): PayableSummary {
  let grossUsd = 0;
  let grossBs = 0;
  for (const row of ctx.perObligationRows) {
    grossUsd += row.grossUsd;
    grossBs += row.grossBs;
  }

  // paidBs = Σ pagos de todos los lotes que matchean.
  let paidBs = 0;
  for (const [, v] of ctx.paidByPayable) paidBs += v;

  let netBs = 0;
  let pendingBs = 0;
  const seenLote = new Set<string>();
  for (let i = 0; i < obligations.length; i++) {
    const r = obligations[i];
    if (r.payableId) {
      if (seenLote.has(r.payableId)) continue;
      seenLote.add(r.payableId);
      const net = round2(ctx.loteNetBs.get(r.payableId) ?? 0);
      netBs += net;
      if (r.payableStatus !== 'paid') {
        const paid = round2(ctx.paidByPayable.get(r.payableId) ?? 0);
        pendingBs += Math.max(0, round2(net - paid));
      }
    } else {
      netBs += ctx.perObligationRows[i].netBs;
      pendingBs += ctx.perObligationRows[i].netBs;
    }
  }

  return {
    count: ctx.perObligationRows.length,
    grossUsd: round2(grossUsd),
    grossBs: round2(grossBs),
    netBs: round2(netBs),
    paidBs: round2(paidBs),
    pendingBs: round2(pendingBs),
  };
}

/**
 * Cuadro resumen por proveedor: cuánto se le facturó, cuánto se le abonó y
 * cuánto falta. Mismas fórmulas que la summary global, aplicadas por
 * proveedor. Sale ordenado por lo que falta pagar, que es como lo revisa
 * administración.
 */
export function groupPayablesByProvider(
  obligations: PayableObligationRef[],
  perObligationRows: PayableRowAmounts[],
  ctx: PayableLoteMaps,
): PayableProviderTotals[] {
  type ProvAgg = Omit<
    PayableProviderTotals,
    'ordersCount' | 'lotesCount'
  > & { orders: Set<string>; lotes: Set<string> };

  const provMap = new Map<string, ProvAgg>();

  // Bruto por proveedor desde las obligaciones (incluye las que no tienen lote).
  for (let i = 0; i < obligations.length; i++) {
    const r = obligations[i];
    const row = perObligationRows[i];
    const key = payableProviderKey(r);
    let agg = provMap.get(key);
    if (!agg) {
      agg = {
        providerType: r.providerType,
        providerId: r.providerType === 'doctor' ? r.doctorId : r.careCenterId,
        providerName: r.providerName ?? '—',
        orders: new Set(),
        lotes: new Set(),
        grossUsd: 0,
        grossBs: 0,
        netBs: 0,
        paidBs: 0,
        pendingBs: 0,
        paidUsd: 0,
        pendingUsd: 0,
      };
      provMap.set(key, agg);
    }
    agg.orders.add(r.orderId);
    agg.grossUsd += row.grossUsd;
    agg.grossBs += row.grossBs;
    if (r.payableId) agg.lotes.add(r.payableId);
  }

  // Pagado y pendiente: una sola pasada por lote para no duplicar.
  const seenLotePerProv = new Map<string, Set<string>>();
  for (let i = 0; i < obligations.length; i++) {
    const r = obligations[i];
    const row = perObligationRows[i];
    const key = payableProviderKey(r);
    const agg = provMap.get(key)!;
    if (r.payableId) {
      let seen = seenLotePerProv.get(key);
      if (!seen) {
        seen = new Set();
        seenLotePerProv.set(key, seen);
      }
      if (seen.has(r.payableId)) continue;
      seen.add(r.payableId);
      const netBs = round2(ctx.loteNetBs.get(r.payableId) ?? 0);
      const paidBs = round2(ctx.paidByPayable.get(r.payableId) ?? 0);
      agg.netBs += netBs;
      agg.paidBs += paidBs;
      if (r.payableStatus !== 'paid')
        agg.pendingBs += Math.max(0, round2(netBs - paidBs));
      const grossUsd = round2(ctx.loteGrossUsd.get(r.payableId) ?? 0);
      const coveredUsd = round2(ctx.loteCoveredUsd.get(r.payableId) ?? 0);
      agg.paidUsd += coveredUsd;
      agg.pendingUsd += Math.max(0, round2(grossUsd - coveredUsd));
    } else {
      // Sin lote: no hay deuda formalizada todavía, pero se le debe igual.
      agg.netBs += row.netBs;
      agg.pendingBs += row.netBs;
      agg.pendingUsd += row.grossUsd;
    }
  }

  return Array.from(provMap.values())
    .map((a) => ({
      providerType: a.providerType,
      providerId: a.providerId,
      providerName: a.providerName,
      ordersCount: a.orders.size,
      lotesCount: a.lotes.size,
      grossUsd: round2(a.grossUsd),
      grossBs: round2(a.grossBs),
      netBs: round2(a.netBs),
      paidBs: round2(a.paidBs),
      pendingBs: round2(a.pendingBs),
      paidUsd: round2(a.paidUsd),
      pendingUsd: round2(a.pendingUsd),
    }))
    .sort((x, y) => y.pendingUsd - x.pendingUsd || y.grossUsd - x.grossUsd);
}
