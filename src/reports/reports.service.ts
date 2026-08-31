import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TaxUnitsService } from '../tax-units/tax-units.service';
import { resolveUsdRate } from '../shared/utils/payment-conversion';
import { calcRetention, SeniatPersonType } from '../shared/utils/seniat-retention';
import {
  QueryPayablesReportDto,
  QueryReceivablesReportDto,
  QueryReportsDto,
} from './dto/query-reports.dto';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Servicio de reportes financieros. A diferencia del modelo viejo (que sólo leía
 * lotes), estos reportes son COMPLETOS (incluyen las obligaciones "Pendientes" sin
 * lote) y EXACTOS en Bs: cada obligación se convierte a Bs usando la tasa de
 * facturación de SU orden (`orders.billingExchangeRateId`), no una tasa de mercado
 * única.
 *
 * Las cuentas pagado/pendiente se computan así (idénticas a la summary):
 *  - paidBs (AP)        = Σ pagos (amountInBs) de todos los lotes AP que matchean.
 *  - pendingBs (AP)     = Σ sobre lotes no-pagados de max(0, loteNetoBs − lotePagadoBs)
 *                         + Σ sobre obligaciones SIN LOTE de su netoBs.
 *  - collected (AR)     = Σ pagos (usd-mode → amountInUsd, fixed-mode → amountInBs).
 *  - pending (AR)       = Σ sobre lotes no-cobrados de max(0, target − cobrado)
 *                         + Σ sobre órdenes SIN LOTE de su target.
 *  - paidBs (retención) = Σ pagos (amountInBs) de los lotes SENIAT.
 *  - pendingBs (ret.)   = Σ sobre lotes SENIAT no-pagados de max(0, ΣtaxAmountBs − Σpagos)
 *                         + Σ sobre obligaciones SIN LOTE de su taxAmountBs.
 *
 * NOTA: la `retentionBs` mostrada POR OBLIGACIÓN es un ESTIMADO (se calcula sobre
 * el bruto de esa obligación). La retención REAL del SENIAT se computa sobre el
 * bruto AGREGADO del lote (por el sustraendo PNR), que puede diferir de la suma
 * de estimados por-obligación. Los totales de retención del reporte taxes-retained
 * usan la retención REAL (taxes_payable.taxAmountBs).
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(ExchangeRate)
    private readonly ratesRepo: Repository<ExchangeRate>,
    private readonly dataSource: DataSource,
    private readonly taxUnits: TaxUnitsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Scope de sucursal (Super Admin ve todo; nunca confiar en el FE).
  // Devuelve null si el usuario es Super Admin (sin filtro); sino el array de ids.
  // ---------------------------------------------------------------------------
  private async resolveUserBranchIds(user: AuthenticatedUser): Promise<string[]> {
    if (user.isSuperAdmin) {
      const all = await this.branchesRepo.find({
        where: { isActive: true, deletedAt: IsNull() },
        select: ['id'],
      });
      return all.map((b) => b.id);
    }
    const u = await this.dataSource
      .createQueryBuilder()
      .select('b.id', 'id')
      .from('user_branches', 'ub')
      .innerJoin('branches', 'b', 'b.id = ub."branchId"')
      .where('ub."userId" = :uid', { uid: user.id })
      .andWhere('b."isActive" = true')
      .andWhere('b."deletedAt" IS NULL')
      .getRawMany<{ id: string }>();
    return u.map((r) => r.id);
  }

  private async currentTaxUnitBs(): Promise<number> {
    const ut = await this.taxUnits.getCurrentOrThrow();
    return Number(ut.amountBs);
  }

  /** Tasa USD/Bs por defecto (última activa) para fallback de obligaciones sin billingExchangeRateId. */
  private async fallbackUsdRateBs(): Promise<number> {
    const rate = await resolveUsdRate(this.ratesRepo, null);
    return Number(rate.amountBs);
  }

  /**
   * Construye filtros WHERE comunes sobre la orden (alias `o`). Aplica scope de
   * sucursal y los filtros de fecha/branch del DTO. Devuelve sql + params.
   */
  private async orderScopeWhere(
    user: AuthenticatedUser,
    query: QueryReportsDto,
    alias = 'o',
  ): Promise<{ sql: string; params: unknown[]; blocked: boolean }> {
    const where: string[] = [`${alias}.status = 'finalized'`, `${alias}."deletedAt" IS NULL`];
    const params: unknown[] = [];

    const allowed = await this.resolveUserBranchIds(user);
    if (!user.isSuperAdmin) {
      if (allowed.length === 0) return { sql: '', params: [], blocked: true };
      params.push(allowed);
      where.push(`${alias}."branchId" = ANY($${params.length})`);
    }
    if (query.branchId) {
      params.push(query.branchId);
      where.push(`${alias}."branchId" = $${params.length}`);
    }
    if (query.from) {
      params.push(query.from);
      where.push(`${alias}."orderDate" >= $${params.length}`);
    }
    if (query.to) {
      params.push(query.to);
      where.push(`${alias}."orderDate" <= $${params.length}`);
    }
    return { sql: where.join(' AND '), params, blocked: false };
  }

  // ===========================================================================
  // 1. PAYABLES
  // ===========================================================================
  async payables(
    query: QueryPayablesReportDto,
    user: AuthenticatedUser,
  ): Promise<{ rows: unknown[]; summary: Record<string, number> }> {
    const scope = await this.orderScopeWhere(user, query);
    if (scope.blocked) return { rows: [], summary: this.emptyPayableSummary() };

    const taxUnitBs = await this.currentTaxUnitBs();
    const fallbackRateBs = await this.fallbackUsdRateBs();

    // Filtros adicionales específicos de proveedor.
    const where = [scope.sql];
    const params = [...scope.params];
    where.push(`iio."providerAmountUsd" IS NOT NULL`);
    if (query.doctorId) {
      params.push(query.doctorId);
      where.push(`iio."doctorId" = $${params.length}`);
    }
    if (query.careCenterId) {
      params.push(query.careCenterId);
      where.push(`iio."careCenterId" = $${params.length}`);
    }
    if (query.search && query.search.trim()) {
      params.push(`%${query.search.trim().toLowerCase()}%`);
      const n = params.length;
      where.push(
        `(LOWER(iio."internalNumber") LIKE $${n}
          OR LOWER(o."orderNumber") LIKE $${n}
          OR LOWER(COALESCE(d."firstName" || ' ' || d."lastName", cc."businessName", '')) LIKE $${n})`,
      );
    }

    // Una fila por obligación (order_internal_orders facturada). Trae estado del lote.
    const allObligations = await this.dataSource.query<
      Array<{
        internalOrderId: string;
        orderId: string;
        orderNumber: string;
        internalNumber: string;
        orderDate: string;
        branchId: string;
        branchName: string | null;
        providerType: 'doctor' | 'care_center';
        doctorId: string | null;
        careCenterId: string | null;
        doctorIsLegal: boolean | null;
        providerName: string | null;
        patientName: string | null;
        insuranceName: string | null;
        procedure: string | null;
        facturacionUsd: string | null;
        grossUsd: string;
        billingRateBs: string | null;
        payableId: string | null;
        payableNumber: string | null;
        payableStatus: string | null;
      }>
    >(
      `SELECT iio.id AS "internalOrderId", iio."orderId", o."orderNumber",
              iio."internalNumber", o."orderDate", o."branchId", b."name" AS "branchName",
              iio."providerType", iio."doctorId", iio."careCenterId",
              d."isLegalEntity" AS "doctorIsLegal",
              COALESCE(d."firstName" || ' ' || d."lastName", cc."businessName") AS "providerName",
              COALESCE(pac."businessName", NULLIF(TRIM(COALESCE(pac."firstName", '') || ' ' || COALESCE(pac."lastName", '')), '')) AS "patientName",
              i."name" AS "insuranceName",
              (SELECT string_agg(DISTINCT ost."customName", ', ')
                 FROM "order_service_types" ost
                 WHERE ost."internalOrderId" = iio.id) AS "procedure",
              (SELECT COALESCE(SUM(osp."priceUsd" * ost."quantity"), 0)
                 FROM "order_service_types" ost
                 JOIN "order_service_pricing" osp
                   ON osp."orderId" = ost."orderId"
                  AND osp."serviceTypeId" = ost."serviceTypeId"
                  AND osp."kind" IN ('particular', 'insurance')
                 WHERE ost."internalOrderId" = iio.id)::text AS "facturacionUsd",
              iio."providerAmountUsd"::text AS "grossUsd",
              fx."amountBs"::text AS "billingRateBs",
              ap.id AS "payableId", ap."payableNumber", ap.status AS "payableStatus"
       FROM "order_internal_orders" iio
       JOIN "orders" o ON o.id = iio."orderId"
       LEFT JOIN "branches" b ON b.id = o."branchId"
       LEFT JOIN "doctors" d ON d.id = iio."doctorId"
       LEFT JOIN "care_centers" cc ON cc.id = iio."careCenterId"
       LEFT JOIN "patients" pac ON pac.id = o."patientId"
       LEFT JOIN "insurances" i ON i.id = o."insuranceId"
       LEFT JOIN "exchange_rates" fx ON fx.id = o."billingExchangeRateId"
       LEFT JOIN "accounts_payable_orders" apo ON apo."internalOrderId" = iio.id
       LEFT JOIN "accounts_payable" ap ON ap.id = apo."payableId"
       WHERE ${where.join(' AND ')}
       ORDER BY iio."internalNumber"::int DESC`,
      params,
    );

    // Filtro de estado: se aplica sobre el estado derivado (lote o sin_lote).
    // El FE etiqueta `sin_lote` igual que `unpaid` ("Por pagar"), así que
    // `status=unpaid` incluye ambas. Filtrar aquí (y no después) garantiza que
    // filas, lotes y summary se calculen sobre el mismo conjunto.
    const obligations = query.status
      ? allObligations.filter((r) => {
          const state = r.payableId ? (r.payableStatus ?? 'unpaid') : 'sin_lote';
          if (query.status === 'unpaid') return state === 'unpaid' || state === 'sin_lote';
          return state === query.status;
        })
      : allObligations;

    // Pagos por lote (amountInBs) — los lotes relevantes son los que aparecen arriba.
    const payableIds = Array.from(
      new Set(obligations.map((r) => r.payableId).filter(Boolean) as string[]),
    );
    const paidByPayable = await this.paidBsByPayable(payableIds);
    const paymentMetaByPayable = await this.paymentMetaByPayable(payableIds);

    // TotalBs por lote (Σ obligaciones × tasa de facturación de cada orden) y
    // su persona fiscal (todas las órdenes de un lote son del mismo proveedor).
    const loteGrossBs = new Map<string, number>();
    const loteGrossUsd = new Map<string, number>();
    const lotePersonType = new Map<string, SeniatPersonType>();
    for (const r of obligations) {
      if (!r.payableId) continue;
      const rateBs = r.billingRateBs != null ? num(r.billingRateBs) : fallbackRateBs;
      const grossBs = num(r.grossUsd) * rateBs;
      loteGrossBs.set(r.payableId, (loteGrossBs.get(r.payableId) ?? 0) + grossBs);
      loteGrossUsd.set(r.payableId, (loteGrossUsd.get(r.payableId) ?? 0) + num(r.grossUsd));
      lotePersonType.set(r.payableId, this.personTypeFor(r.providerType, r.doctorIsLegal));
    }
    // Neto Bs por lote = bruto − retención REAL (calculada sobre el bruto agregado).
    const loteNetBs = new Map<string, number>();
    for (const [pid, grossBs] of loteGrossBs) {
      const retention = calcRetention({
        grossBs: round2(grossBs),
        personType: lotePersonType.get(pid) ?? 'natural',
        taxUnitBs,
      });
      loteNetBs.set(pid, round2(round2(grossBs) - retention.taxAmountBs));
    }

    // ---- Filas por obligación (estimado de retención por fila) ----
    const perObligationRows = obligations.map((r) => {
      const rateBs = r.billingRateBs != null ? num(r.billingRateBs) : fallbackRateBs;
      const grossBs = round2(num(r.grossUsd) * rateBs);
      const personType = this.personTypeFor(r.providerType, r.doctorIsLegal);
      // Estimado: retención sobre el bruto de esta sola obligación.
      const retentionBs = round2(
        calcRetention({ grossBs, personType, taxUnitBs }).taxAmountBs,
      );
      const netBs = round2(grossBs - retentionBs);
      const state: string = r.payableId ? (r.payableStatus ?? 'unpaid') : 'sin_lote';
      const meta = r.payableId ? paymentMetaByPayable.get(r.payableId) : undefined;
      return {
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        internalNumber: r.internalNumber,
        orderDate: r.orderDate,
        branchId: r.branchId,
        branchName: r.branchName,
        providerType: r.providerType,
        providerId: r.providerType === 'doctor' ? r.doctorId : r.careCenterId,
        providerName: r.providerName ?? '—',
        patientName: r.patientName ?? '—',
        insuranceName: r.insuranceName,
        procedure: r.procedure,
        facturacionUsd: round2(num(r.facturacionUsd)),
        personType,
        grossUsd: round2(num(r.grossUsd)),
        billingRateBs: round2(rateBs),
        grossBs,
        retentionBs,
        netBs,
        payableId: r.payableId,
        payableNumber: r.payableNumber,
        paymentDate: meta?.date ?? null,
        paymentReference: meta?.ref ?? null,
        state,
      };
    });

    // ---- Summary global (paid/pending exactos) ----
    const summary = this.computePayableSummary(obligations, {
      paidByPayable,
      loteGrossBs,
      loteGrossUsd,
      loteNetBs,
      perObligationRows,
    });

    if (query.groupBy !== 'provider') {
      return { rows: perObligationRows, summary };
    }

    // ---- groupBy=provider ----
    type ProvAgg = {
      providerType: 'doctor' | 'care_center';
      providerId: string | null;
      providerName: string;
      orders: Set<string>;
      lotes: Set<string>;
      grossUsd: number;
      grossBs: number;
      netBs: number;
      paidBs: number;
      pendingBs: number;
    };
    const provMap = new Map<string, ProvAgg>();
    const provKey = (r: { providerType: string; doctorId: string | null; careCenterId: string | null }) =>
      r.providerType === 'doctor' ? `doctor:${r.doctorId}` : `cc:${r.careCenterId}`;

    // Acumula bruto/neto por proveedor desde las obligaciones (incluye sin lote).
    for (let i = 0; i < obligations.length; i++) {
      const r = obligations[i];
      const row = perObligationRows[i];
      const key = provKey(r);
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
        };
        provMap.set(key, agg);
      }
      agg.orders.add(r.orderId);
      agg.grossUsd += row.grossUsd;
      agg.grossBs += row.grossBs;
      if (r.payableId) agg.lotes.add(r.payableId);
    }

    // paidBs y pendingBs por proveedor (mismas fórmulas que la summary, por proveedor).
    // Para evitar doble conteo, recorrer lotes únicos y obligaciones sin lote.
    const seenLotePerProv = new Map<string, Set<string>>();
    for (let i = 0; i < obligations.length; i++) {
      const r = obligations[i];
      const row = perObligationRows[i];
      const key = provKey(r);
      const agg = provMap.get(key)!;
      if (r.payableId) {
        let seen = seenLotePerProv.get(key);
        if (!seen) {
          seen = new Set();
          seenLotePerProv.set(key, seen);
        }
        if (!seen.has(r.payableId)) {
          seen.add(r.payableId);
          const netBs = round2(loteNetBs.get(r.payableId) ?? 0);
          const paidBs = round2(paidByPayable.get(r.payableId) ?? 0);
          agg.netBs += netBs;
          agg.paidBs += paidBs;
          if (r.payableStatus !== 'paid') agg.pendingBs += Math.max(0, round2(netBs - paidBs));
        }
      } else {
        // Sin lote: neto de la obligación cuenta como pendiente; netoBs aporta a netBs.
        agg.netBs += row.netBs;
        agg.pendingBs += row.netBs;
      }
    }

    const groupRows = Array.from(provMap.values())
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
      }))
      .sort((x, y) => y.grossUsd - x.grossUsd);

    return { rows: groupRows, summary };
  }

  private personTypeFor(
    providerType: 'doctor' | 'care_center',
    doctorIsLegal: boolean | null,
  ): SeniatPersonType {
    if (providerType === 'care_center') return 'legal_entity';
    return doctorIsLegal ? 'legal_entity' : 'natural';
  }

  /** Σ amountInBs de pagos de cada lote AP. */
  private async paidBsByPayable(payableIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (payableIds.length === 0) return out;
    const rows = await this.dataSource.query<Array<{ payableId: string; paid: string }>>(
      `SELECT l."payableId", COALESCE(SUM(p."amountInBs"), 0)::text AS paid
       FROM "accounts_payable_payment_links" l
       JOIN "accounts_payable_payments" p ON p.id = l."paymentId"
       WHERE l."payableId" = ANY($1) AND p."deletedAt" IS NULL
       GROUP BY l."payableId"`,
      [payableIds],
    );
    for (const r of rows) out.set(r.payableId, num(r.paid));
    return out;
  }

  /** Fecha (última) y referencias de pago por lote AP, para el edo. de cuenta. */
  private async paymentMetaByPayable(
    payableIds: string[],
  ): Promise<Map<string, { date: string | null; ref: string | null }>> {
    const out = new Map<string, { date: string | null; ref: string | null }>();
    if (payableIds.length === 0) return out;
    const rows = await this.dataSource.query<
      Array<{ payableId: string; date: string | null; ref: string | null }>
    >(
      `SELECT l."payableId",
              MAX(p."paymentDate")::text AS date,
              string_agg(DISTINCT NULLIF(p."referenceNumber", ''), ', ') AS ref
       FROM "accounts_payable_payment_links" l
       JOIN "accounts_payable_payments" p ON p.id = l."paymentId"
       WHERE l."payableId" = ANY($1) AND p."deletedAt" IS NULL
       GROUP BY l."payableId"`,
      [payableIds],
    );
    for (const r of rows) out.set(r.payableId, { date: r.date, ref: r.ref });
    return out;
  }

  private emptyPayableSummary(): Record<string, number> {
    return { count: 0, grossUsd: 0, grossBs: 0, netBs: 0, paidBs: 0, pendingBs: 0 };
  }

  private computePayableSummary(
    obligations: Array<{ payableId: string | null; payableStatus: string | null }>,
    ctx: {
      paidByPayable: Map<string, number>;
      loteGrossBs: Map<string, number>;
      loteGrossUsd: Map<string, number>;
      loteNetBs: Map<string, number>;
      perObligationRows: Array<{ grossUsd: number; grossBs: number; netBs: number }>;
    },
  ): Record<string, number> {
    let grossUsd = 0;
    let grossBs = 0;
    for (const row of ctx.perObligationRows) {
      grossUsd += row.grossUsd;
      grossBs += row.grossBs;
    }
    // paidBs = Σ pagos de todos los lotes que matchean.
    let paidBs = 0;
    for (const [, v] of ctx.paidByPayable) paidBs += v;

    // netBs con la retención REAL del lote (sobre el bruto agregado, una sola
    // vez) + estimado por fila sólo para sin-lote — igual que groupBy=provider.
    // Sumar los estimados por fila aplicaría el sustraendo/umbral PNR una vez
    // por obligación y el neto no cuadraría con los pagos registrados.
    // pendingBs = Σ lotes no-pagados de max(0, loteNet − lotePaid) + Σ sin-lote de netBs.
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

  // ===========================================================================
  // 2. RECEIVABLES
  // ===========================================================================
  async receivables(
    query: QueryReceivablesReportDto,
    user: AuthenticatedUser,
  ): Promise<{ rows: unknown[]; summary: Record<string, number> }> {
    const scope = await this.orderScopeWhere(user, query);
    if (scope.blocked) return { rows: [], summary: this.emptyReceivableSummary() };

    const where = [scope.sql];
    const params = [...scope.params];
    where.push(
      `((o."type" = 'insurance' AND o."insuranceId" IS NOT NULL)
        OR (o."type" IN ('credit','cashea') AND o."holderId" IS NOT NULL))`,
    );
    if (query.insuranceId) {
      params.push(query.insuranceId);
      where.push(`o."insuranceId" = $${params.length}`);
    }
    if (query.holderId) {
      params.push(query.holderId);
      where.push(`o."holderId" = $${params.length}`);
    }
    if (query.status === 'insurance') where.push(`o."type" = 'insurance'`);
    if (query.status === 'holder') where.push(`o."type" IN ('credit','cashea')`);
    if (query.search && query.search.trim()) {
      params.push(`%${query.search.trim().toLowerCase()}%`);
      const n = params.length;
      where.push(
        `(LOWER(o."orderNumber") LIKE $${n}
          OR LOWER(COALESCE(i."name", '')) LIKE $${n}
          OR LOWER(COALESCE(p."firstName", '')) LIKE $${n}
          OR LOWER(COALESCE(p."lastName", '')) LIKE $${n}
          OR LOWER(COALESCE(p."businessName", '')) LIKE $${n})`,
      );
    }

    const orders = await this.dataSource.query<
      Array<{
        orderId: string;
        orderNumber: string;
        orderType: string;
        orderDate: string;
        branchId: string;
        branchName: string | null;
        insuranceId: string | null;
        holderId: string | null;
        insuranceName: string | null;
        firstName: string | null;
        lastName: string | null;
        businessName: string | null;
        holderIdDisplay: string | null;
        patientName: string | null;
        patientIdDisplay: string | null;
        doctorName: string | null;
        serviceKey: string | null;
        invoiceNumber: string | null;
        controlNumber: string | null;
        costoUsd: string | null;
        useFixedRate: boolean;
        priceAmount: string;
        casheaFirstInstallmentAmount: string | null;
        casheaCommissionRate: string | null;
        casheaFinancingRate: string | null;
        fixedRateBs: string | null;
        portion: 'full' | 'fixed' | 'indexed';
        indexedUsd: string;
        receivableId: string | null;
        receivableNumber: string | null;
        receivableStatus: string | null;
        arTargetUsd: string | null;
        arTargetBs: string | null;
        arAdjustment: string | null;
      }>
    >(
      // Expansión por porciones (espeja el listado de Pendientes de AR): una
      // orden mixta (tasa fija + STs indexados) emite 2 filas — porción fija
      // (Bs a la tasa de la orden) y porción indexada (USD, tasa del cobro) —
      // cada una ligada a SU lote (si lo tiene) vía aro.portion.
      `SELECT o.id AS "orderId", o."orderNumber", o."type" AS "orderType", o."orderDate",
              o."branchId", b."name" AS "branchName",
              o."insuranceId", o."holderId", i."name" AS "insuranceName",
              p."firstName", p."lastName", p."businessName",
              COALESCE(p."cedula", p."rif") AS "holderIdDisplay",
              COALESCE(pac."businessName", NULLIF(TRIM(COALESCE(pac."firstName", '') || ' ' || COALESCE(pac."lastName", '')), '')) AS "patientName",
              COALESCE(pac."cedula", pac."rif") AS "patientIdDisplay",
              o."serviceKey", o."invoiceNumber", o."controlNumber",
              (SELECT string_agg(DISTINCT TRIM(COALESCE(doc."firstName", '') || ' ' || COALESCE(doc."lastName", '')), ', ')
                 FROM "order_service_types" ost2
                 JOIN "doctors" doc ON doc.id = ost2."doctorId"
                 WHERE ost2."orderId" = o.id) AS "doctorName",
              (SELECT COALESCE(SUM(iio2."providerAmountUsd"), 0)
                 FROM "order_internal_orders" iio2
                 WHERE iio2."orderId" = o.id)::text AS "costoUsd",
              o."useFixedRate", o."priceAmount"::text AS "priceAmount",
              o."casheaFirstInstallmentAmount"::text AS "casheaFirstInstallmentAmount",
              o."casheaCommissionRate"::text AS "casheaCommissionRate",
              o."casheaFinancingRate"::text AS "casheaFinancingRate",
              fx."amountBs"::text AS "fixedRateBs",
              pt.portion AS "portion", ix."indexedUsd"::text AS "indexedUsd",
              ar.id AS "receivableId", ar."receivableNumber", ar.status AS "receivableStatus",
              aro."targetUsd"::text AS "arTargetUsd", aro."targetBs"::text AS "arTargetBs",
              ar."adjustmentAmount"::text AS "arAdjustment"
       FROM "orders" o
       LEFT JOIN "branches" b ON b.id = o."branchId"
       LEFT JOIN "insurances" i ON i.id = o."insuranceId"
       LEFT JOIN "patients" p ON p.id = o."holderId"
       LEFT JOIN "patients" pac ON pac.id = o."patientId"
       LEFT JOIN "exchange_rates" fx ON fx.id = o."fixedExchangeRateId"
       CROSS JOIN LATERAL (
         SELECT COALESCE(SUM(ROUND(osp."priceUsd" * ost."quantity", 2)), 0) AS "indexedUsd"
         FROM "order_service_types" ost
         JOIN "order_service_pricing" osp
           ON osp."orderId" = ost."orderId"
          AND osp."serviceTypeId" = ost."serviceTypeId"
          AND osp."kind" = 'insurance'
         WHERE ost."orderId" = o.id AND ost."isIndexed" = true
       ) ix
       CROSS JOIN LATERAL (VALUES ('full'), ('fixed'), ('indexed')) pt(portion)
       LEFT JOIN "accounts_receivable_orders" aro
         ON aro."orderId" = o.id AND aro."portion" = pt.portion
       LEFT JOIN "accounts_receivable" ar ON ar.id = aro."receivableId"
       WHERE ${where.join(' AND ')}
         AND (
           (pt.portion = 'full' AND (o."useFixedRate" = false OR ix."indexedUsd" <= 0))
           OR (pt.portion = 'indexed' AND o."useFixedRate" = true AND ix."indexedUsd" > 0)
           OR (pt.portion = 'fixed' AND o."useFixedRate" = true AND ix."indexedUsd" > 0
               AND ix."indexedUsd" < o."priceAmount")
         )
       ORDER BY o."orderNumber"::int DESC, pt.portion`,
      params,
    );

    // Cobros por lote (usd-mode → amountInUsd; fixed-mode → amountInBs).
    const receivableIds = Array.from(
      new Set(orders.map((r) => r.receivableId).filter(Boolean) as string[]),
    );
    const { collectedUsd, collectedBs } = await this.collectedByReceivable(receivableIds);

    // Modo del lote (fixed si alguna orden usa tasa fija) y target agregado por lote.
    const loteMode = new Map<string, 'usd' | 'fixed'>();
    const loteTargetUsd = new Map<string, number>();
    const loteTargetBs = new Map<string, number>();
    // Ajuste del lote (resta/suma sobre el total a cobrar), en la moneda del
    // lote. Es a nivel de LOTE: no se reparte por orden, se suma una vez.
    const loteAdjustment = new Map<string, number>();
    // Modo efectivo de la fila: la porción manda sobre el flag de la orden
    // (porción indexada de una orden tasa fija = modo USD).
    const rowFixed = (r: { portion: string; useFixedRate: boolean }): boolean =>
      r.portion === 'fixed' ? true : r.portion === 'indexed' ? false : r.useFixedRate;
    for (const r of orders) {
      if (!r.receivableId) continue;
      const isFixed = rowFixed(r);
      const prior = loteMode.get(r.receivableId);
      loteMode.set(r.receivableId, prior === 'fixed' || isFixed ? 'fixed' : 'usd');
      loteTargetUsd.set(
        r.receivableId,
        (loteTargetUsd.get(r.receivableId) ?? 0) + num(r.arTargetUsd),
      );
      loteTargetBs.set(
        r.receivableId,
        (loteTargetBs.get(r.receivableId) ?? 0) + num(r.arTargetBs),
      );
      loteAdjustment.set(r.receivableId, num(r.arAdjustment));
    }
    // El ajuste entra una sola vez al target del lote, en su moneda.
    for (const [lote, adj] of loteAdjustment) {
      if (!adj) continue;
      if (loteMode.get(lote) === 'fixed') {
        loteTargetBs.set(lote, Math.max(0, (loteTargetBs.get(lote) ?? 0) + adj));
      } else {
        loteTargetUsd.set(lote, Math.max(0, (loteTargetUsd.get(lote) ?? 0) + adj));
      }
    }

    const perOrderRows = orders.map((r) => {
      const debtorType: 'insurance' | 'holder' = r.orderType === 'insurance' ? 'insurance' : 'holder';
      const debtorName =
        debtorType === 'insurance'
          ? r.insuranceName ?? '—'
          : r.businessName ?? (`${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '—');
      // Target por porción: 'full' replica ar-targets; 'fixed'/'indexed'
      // reparten el priceAmount según los STs indexados de la orden.
      let targetUsd: number | null;
      let targetBs: number | null;
      if (r.portion === 'full') {
        ({ targetUsd, targetBs } = this.orderTarget(r));
      } else {
        const price = num(r.priceAmount);
        const indexedUsd = Math.min(num(r.indexedUsd), price);
        if (r.portion === 'indexed') {
          targetUsd = round2(indexedUsd);
          targetBs = null;
        } else {
          targetUsd = null;
          targetBs = round2(Math.max(0, price - indexedUsd) * num(r.fixedRateBs));
        }
      }
      const state: string = r.receivableId ? (r.receivableStatus ?? 'uncollected') : 'sin_lote';
      const holderName =
        r.businessName ?? (`${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '—');
      const isFixedRow = rowFixed(r);
      return {
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        orderType: r.orderType,
        orderDate: r.orderDate,
        branchId: r.branchId,
        branchName: r.branchName,
        debtorType,
        debtorId: debtorType === 'insurance' ? r.insuranceId : r.holderId,
        debtorName,
        holderName,
        holderId: r.holderIdDisplay ?? '',
        patientName: r.patientName ?? holderName,
        patientId: r.patientIdDisplay ?? '',
        doctorName: r.doctorName ?? '',
        serviceKey: r.serviceKey ?? '',
        invoiceNumber: r.invoiceNumber ?? '',
        controlNumber: r.controlNumber ?? '',
        costoUsd: round2(num(r.costoUsd)),
        useFixedRate: isFixedRow,
        rateBs: isFixedRow ? round2(num(r.fixedRateBs)) : null,
        portion: r.portion,
        targetUsd,
        targetBs,
        receivableId: r.receivableId,
        receivableNumber: r.receivableNumber,
        state,
      };
    });

    const summary = this.computeReceivableSummary(orders, perOrderRows, {
      collectedUsd,
      collectedBs,
      loteMode,
      loteTargetUsd,
      loteTargetBs,
      loteAdjustment,
    });

    if (query.groupBy !== 'insurance' && query.groupBy !== 'holder') {
      return { rows: perOrderRows, summary };
    }

    // ---- groupBy=insurance|holder ----
    type DebtorAgg = {
      debtorType: 'insurance' | 'holder';
      debtorId: string | null;
      debtorName: string;
      orders: Set<string>;
      lotes: Set<string>;
      targetUsd: number;
      targetBs: number;
      collectedUsd: number;
      collectedBs: number;
      pendingUsd: number;
      pendingBs: number;
    };
    const map = new Map<string, DebtorAgg>();
    const seenLotePerDebtor = new Map<string, Set<string>>();
    for (let i = 0; i < orders.length; i++) {
      const r = orders[i];
      const row = perOrderRows[i];
      if (query.groupBy === 'insurance' && row.debtorType !== 'insurance') continue;
      if (query.groupBy === 'holder' && row.debtorType !== 'holder') continue;
      const key = `${row.debtorType}:${row.debtorId}`;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          debtorType: row.debtorType,
          debtorId: row.debtorId,
          debtorName: row.debtorName,
          orders: new Set(),
          lotes: new Set(),
          targetUsd: 0,
          targetBs: 0,
          collectedUsd: 0,
          collectedBs: 0,
          pendingUsd: 0,
          pendingBs: 0,
        };
        map.set(key, agg);
      }
      agg.orders.add(r.orderId);
      agg.targetUsd += num(row.targetUsd);
      agg.targetBs += num(row.targetBs);
      if (r.receivableId) {
        agg.lotes.add(r.receivableId);
        let seen = seenLotePerDebtor.get(key);
        if (!seen) {
          seen = new Set();
          seenLotePerDebtor.set(key, seen);
        }
        if (!seen.has(r.receivableId)) {
          seen.add(r.receivableId);
          const mode = loteMode.get(r.receivableId) ?? 'usd';
          if (mode === 'fixed') {
            const tgt = round2(loteTargetBs.get(r.receivableId) ?? 0);
            const col = round2(collectedBs.get(r.receivableId) ?? 0);
            agg.collectedBs += col;
            if (r.receivableStatus !== 'collected' && r.receivableStatus !== 'overcollected') {
              agg.pendingBs += Math.max(0, round2(tgt - col));
            }
          } else {
            const tgt = round2(loteTargetUsd.get(r.receivableId) ?? 0);
            const col = round2(collectedUsd.get(r.receivableId) ?? 0);
            agg.collectedUsd += col;
            if (r.receivableStatus !== 'collected' && r.receivableStatus !== 'overcollected') {
              agg.pendingUsd += Math.max(0, round2(tgt - col));
            }
          }
        }
      } else {
        // Sin lote: target completo es pendiente, en su moneda nativa.
        if (row.useFixedRate) agg.pendingBs += num(row.targetBs);
        else agg.pendingUsd += num(row.targetUsd);
      }
    }

    const groupRows = Array.from(map.values())
      .map((a) => ({
        debtorType: a.debtorType,
        debtorId: a.debtorId,
        debtorName: a.debtorName,
        ordersCount: a.orders.size,
        lotesCount: a.lotes.size,
        targetUsd: round2(a.targetUsd),
        targetBs: round2(a.targetBs),
        collectedUsd: round2(a.collectedUsd),
        collectedBs: round2(a.collectedBs),
        pendingUsd: round2(a.pendingUsd),
        pendingBs: round2(a.pendingBs),
      }))
      .sort((x, y) => y.targetUsd - x.targetUsd);

    return { rows: groupRows, summary };
  }

  /** Calcula target USD/Bs por orden (replica ar-targets sin cargar la entidad). */
  private orderTarget(r: {
    orderType: string;
    useFixedRate: boolean;
    priceAmount: string;
    casheaFirstInstallmentAmount: string | null;
    casheaCommissionRate: string | null;
    casheaFinancingRate: string | null;
    fixedRateBs: string | null;
  }): { targetUsd: number | null; targetBs: number | null } {
    const price = num(r.priceAmount);
    if (r.useFixedRate) {
      const rateBs = num(r.fixedRateBs);
      return { targetUsd: null, targetBs: round2(price * rateBs) };
    }
    if (r.orderType === 'cashea') {
      // Espeja ar-targets (targetUsdForOrder). La inicial la pagó el titular en
      // el Paso 1, no entra en la cuenta por cobrar:
      //   restante      = total − inicial
      //   comisión      = total × commissionRate
      //   financiamiento= restante × financingRate
      //   target        = restante − comisión − financiamiento
      const initial = num(r.casheaFirstInstallmentAmount);
      const commissionRate = num(r.casheaCommissionRate);
      const financingRate = num(r.casheaFinancingRate);
      const priceCents = Math.round(price * 100);
      const initialCents = Math.round(initial * 100);
      const remainingCents = Math.max(0, priceCents - initialCents);
      const rc = Math.round(commissionRate * 10000);
      const rf = Math.round(financingRate * 10000);
      const commissionCents = Math.round((priceCents * rc) / 10000);
      const financingCents = Math.round((remainingCents * rf) / 10000);
      const netCents = Math.max(
        0,
        remainingCents - commissionCents - financingCents,
      );
      return { targetUsd: netCents / 100, targetBs: null };
    }
    return { targetUsd: round2(price), targetBs: null };
  }

  private async collectedByReceivable(
    ids: string[],
  ): Promise<{ collectedUsd: Map<string, number>; collectedBs: Map<string, number> }> {
    const collectedUsd = new Map<string, number>();
    const collectedBs = new Map<string, number>();
    if (ids.length === 0) return { collectedUsd, collectedBs };
    const rows = await this.dataSource.query<
      Array<{ receivableId: string; usd: string; bs: string }>
    >(
      `SELECT l."receivableId", COALESCE(SUM(p."amountInUsd"), 0)::text AS usd,
              COALESCE(SUM(p."amountInBs"), 0)::text AS bs
       FROM "accounts_receivable_payment_links" l
       JOIN "accounts_receivable_payments" p ON p.id = l."paymentId"
       WHERE l."receivableId" = ANY($1) AND p."deletedAt" IS NULL
       GROUP BY l."receivableId"`,
      [ids],
    );
    for (const r of rows) {
      collectedUsd.set(r.receivableId, num(r.usd));
      collectedBs.set(r.receivableId, num(r.bs));
    }
    return { collectedUsd, collectedBs };
  }

  private emptyReceivableSummary(): Record<string, number> {
    return {
      count: 0,
      targetUsd: 0,
      targetBs: 0,
      collectedUsd: 0,
      collectedBs: 0,
      pendingUsd: 0,
      pendingBs: 0,
    };
  }

  private computeReceivableSummary(
    orders: Array<{
      orderId: string;
      receivableId: string | null;
      receivableStatus: string | null;
      useFixedRate: boolean;
    }>,
    perOrderRows: Array<{ targetUsd: number | null; targetBs: number | null; useFixedRate: boolean }>,
    ctx: {
      collectedUsd: Map<string, number>;
      collectedBs: Map<string, number>;
      loteMode: Map<string, 'usd' | 'fixed'>;
      loteTargetUsd: Map<string, number>;
      loteTargetBs: Map<string, number>;
      /** Ajuste por lote (resta/suma) en la moneda del lote. */
      loteAdjustment?: Map<string, number>;
    },
  ): Record<string, number> {
    let targetUsd = 0;
    let targetBs = 0;
    for (const row of perOrderRows) {
      targetUsd += num(row.targetUsd);
      targetBs += num(row.targetBs);
    }
    // Los targets por fila son el snapshot por orden (sin ajuste): el ajuste
    // vive en el lote, así que se suma una vez por lote en su moneda.
    for (const [lote, adj] of ctx.loteAdjustment ?? []) {
      if (!adj) continue;
      if (ctx.loteMode.get(lote) === 'fixed') targetBs += adj;
      else targetUsd += adj;
    }
    let collectedUsd = 0;
    let collectedBs = 0;
    for (const [, v] of ctx.collectedUsd) collectedUsd += v;
    for (const [, v] of ctx.collectedBs) collectedBs += v;
    // Sólo sumar collected del modo correspondiente.
    let collUsd = 0;
    let collBs = 0;
    const seen = new Set<string>();
    let pendingUsd = 0;
    let pendingBs = 0;
    for (let i = 0; i < orders.length; i++) {
      const r = orders[i];
      const row = perOrderRows[i];
      if (r.receivableId) {
        if (seen.has(r.receivableId)) continue;
        seen.add(r.receivableId);
        const mode = ctx.loteMode.get(r.receivableId) ?? 'usd';
        if (mode === 'fixed') {
          const tgt = round2(ctx.loteTargetBs.get(r.receivableId) ?? 0);
          const col = round2(ctx.collectedBs.get(r.receivableId) ?? 0);
          collBs += col;
          if (r.receivableStatus !== 'collected' && r.receivableStatus !== 'overcollected') {
            pendingBs += Math.max(0, round2(tgt - col));
          }
        } else {
          const tgt = round2(ctx.loteTargetUsd.get(r.receivableId) ?? 0);
          const col = round2(ctx.collectedUsd.get(r.receivableId) ?? 0);
          collUsd += col;
          if (r.receivableStatus !== 'collected' && r.receivableStatus !== 'overcollected') {
            pendingUsd += Math.max(0, round2(tgt - col));
          }
        }
      } else {
        if (row.useFixedRate) pendingBs += num(row.targetBs);
        else pendingUsd += num(row.targetUsd);
      }
    }
    void collectedUsd;
    void collectedBs;
    return {
      // Órdenes distintas: una orden mixta emite 2 filas (porción fija+indexada)
      // y el FE muestra este valor como "Cantidad de órdenes".
      count: new Set(orders.map((r) => r.orderId)).size,
      targetUsd: round2(targetUsd),
      targetBs: round2(targetBs),
      collectedUsd: round2(collUsd),
      collectedBs: round2(collBs),
      pendingUsd: round2(pendingUsd),
      pendingBs: round2(pendingBs),
    };
  }

  // ===========================================================================
  // 3. TAXES RETAINED
  // ===========================================================================
  async taxesRetained(
    query: QueryReportsDto,
    user: AuthenticatedUser,
  ): Promise<{ rows: unknown[]; summary: Record<string, number> }> {
    const allowed = await this.resolveUserBranchIds(user);
    if (!user.isSuperAdmin && allowed.length === 0) {
      return { rows: [], summary: { count: 0, taxAmountBs: 0, paidBs: 0, pendingBs: 0 } };
    }

    // El scope de sucursal de una retención cuelga de su lote AP → órdenes → branch.
    const where: string[] = ['tp."deletedAt" IS NULL'];
    const params: unknown[] = [];
    if (!user.isSuperAdmin) {
      params.push(allowed);
      where.push(
        `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_s
                 JOIN "order_internal_orders" iio_s ON iio_s.id = apo_s."internalOrderId"
                 JOIN "orders" o_s ON o_s.id = iio_s."orderId"
                 WHERE apo_s."payableId" = tp."sourcePayableId" AND o_s."branchId" = ANY($${params.length}))`,
      );
    }
    if (query.branchId) {
      params.push(query.branchId);
      where.push(
        `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_b
                 JOIN "order_internal_orders" iio_b ON iio_b.id = apo_b."internalOrderId"
                 JOIN "orders" o_b ON o_b.id = iio_b."orderId"
                 WHERE apo_b."payableId" = tp."sourcePayableId" AND o_b."branchId" = $${params.length})`,
      );
    }
    if (query.doctorId) {
      params.push(query.doctorId);
      where.push(`tp."doctorId" = $${params.length}`);
    }
    if (query.careCenterId) {
      params.push(query.careCenterId);
      where.push(`tp."careCenterId" = $${params.length}`);
    }
    if (query.status) {
      params.push(query.status);
      where.push(`tp.status = $${params.length}`);
    }
    // Un solo EXISTS con ambas cotas sobre la MISMA orden: con dos EXISTS
    // independientes, una orden ≥ from y OTRA distinta ≤ to bastaban para
    // colar la retención al rango aunque ninguna orden cayera dentro de él.
    if (query.from || query.to) {
      const conds: string[] = [];
      if (query.from) {
        params.push(query.from);
        conds.push(`o_r."orderDate" >= $${params.length}`);
      }
      if (query.to) {
        params.push(query.to);
        conds.push(`o_r."orderDate" <= $${params.length}`);
      }
      where.push(
        `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_r
                 JOIN "order_internal_orders" iio_r ON iio_r.id = apo_r."internalOrderId"
                 JOIN "orders" o_r ON o_r.id = iio_r."orderId"
                 WHERE apo_r."payableId" = tp."sourcePayableId" AND ${conds.join(' AND ')})`,
      );
    }
    if (query.search && query.search.trim()) {
      params.push(`%${query.search.trim().toLowerCase()}%`);
      const n = params.length;
      where.push(
        `(LOWER(tp."taxPayableNumber") LIKE $${n}
          OR LOWER(COALESCE(d."firstName" || ' ' || d."lastName", cc."businessName", '')) LIKE $${n}
          OR EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_q
                     JOIN "order_internal_orders" iio_q ON iio_q.id = apo_q."internalOrderId"
                     WHERE apo_q."payableId" = tp."sourcePayableId" AND LOWER(iio_q."internalNumber") LIKE $${n}))`,
      );
    }

    const taxes = await this.dataSource.query<
      Array<{
        taxPayableId: string;
        taxPayableNumber: string;
        providerType: 'doctor' | 'care_center';
        doctorId: string | null;
        careCenterId: string | null;
        providerName: string | null;
        personType: SeniatPersonType;
        grossAmountBs: string;
        taxRate: string;
        taxAmountBs: string;
        status: string;
        sourcePayableId: string | null;
        taxBatchId: string | null;
        taxBatchNumber: string | null;
      }>
    >(
      `SELECT tp.id AS "taxPayableId", tp."taxPayableNumber",
              tp."recipientType" AS "providerType", tp."doctorId", tp."careCenterId",
              COALESCE(d."firstName" || ' ' || d."lastName", cc."businessName") AS "providerName",
              tp."personType", tp."grossAmountBs"::text AS "grossAmountBs",
              tp."taxRate"::text AS "taxRate", tp."taxAmountBs"::text AS "taxAmountBs",
              tp.status, tp."sourcePayableId",
              tp."taxPaymentBatchId" AS "taxBatchId", tpb."taxBatchNumber"
       FROM "taxes_payable" tp
       LEFT JOIN "doctors" d ON d.id = tp."doctorId"
       LEFT JOIN "care_centers" cc ON cc.id = tp."careCenterId"
       LEFT JOIN "tax_payment_batches" tpb ON tpb.id = tp."taxPaymentBatchId"
       WHERE ${where.join(' AND ')}
       ORDER BY tp."taxPayableNumber"::int DESC`,
      params,
    );

    // internalNumbers por sourcePayable.
    const sourceIds = Array.from(
      new Set(taxes.map((t) => t.sourcePayableId).filter(Boolean) as string[]),
    );
    const internalByPayable = await this.internalNumbersByPayable(sourceIds);

    // Pagos por lote SENIAT.
    const batchIds = Array.from(
      new Set(taxes.map((t) => t.taxBatchId).filter(Boolean) as string[]),
    );
    const paidByBatch = await this.paidBsByTaxBatch(batchIds);
    // Target Bs por lote SENIAT = Σ taxAmountBs de sus obligaciones (de la query).
    const batchTarget = new Map<string, number>();
    for (const t of taxes) {
      if (!t.taxBatchId) continue;
      batchTarget.set(t.taxBatchId, (batchTarget.get(t.taxBatchId) ?? 0) + num(t.taxAmountBs));
    }
    // Target TOTAL del lote (todas sus obligaciones, sin filtro): si un filtro
    // (search/from/to) deja fuera parte de las obligaciones, los pagos del lote
    // se prorratean por la fracción filtrada — sin esto, "Pagado al SENIAT"
    // sumaba el pago íntegro contra un retenido parcial (avance >100%).
    const batchFullTarget = await this.fullTargetByTaxBatch(batchIds);
    const paidShareByBatch = new Map<string, number>();
    for (const [batchId, paid] of paidByBatch) {
      const filteredTarget = batchTarget.get(batchId) ?? 0;
      const fullTarget = batchFullTarget.get(batchId) ?? 0;
      const share = fullTarget > 0 ? Math.min(1, filteredTarget / fullTarget) : 1;
      paidShareByBatch.set(batchId, round2(paid * share));
    }

    const rows = taxes.map((t) => ({
      taxPayableId: t.taxPayableId,
      taxPayableNumber: t.taxPayableNumber,
      providerType: t.providerType,
      providerId: t.providerType === 'doctor' ? t.doctorId : t.careCenterId,
      providerName: t.providerName ?? '—',
      personType: t.personType,
      grossAmountBs: round2(num(t.grossAmountBs)),
      taxRate: num(t.taxRate),
      taxAmountBs: round2(num(t.taxAmountBs)),
      internalNumbers: t.sourcePayableId ? internalByPayable.get(t.sourcePayableId) ?? [] : [],
      taxBatchId: t.taxBatchId,
      taxBatchNumber: t.taxBatchNumber,
      state: t.taxBatchId ? t.status : 'sin_lote',
    }));

    // Summary (pagos prorrateados a la fracción de obligaciones filtradas).
    let taxAmountBs = 0;
    for (const r of rows) taxAmountBs += r.taxAmountBs;
    let paidBs = 0;
    for (const [, v] of paidShareByBatch) paidBs += v;
    let pendingBs = 0;
    const seenBatch = new Set<string>();
    for (const t of taxes) {
      if (t.taxBatchId) {
        if (seenBatch.has(t.taxBatchId)) continue;
        seenBatch.add(t.taxBatchId);
        if (t.status !== 'paid') {
          const target = round2(batchTarget.get(t.taxBatchId) ?? 0);
          const paid = round2(paidShareByBatch.get(t.taxBatchId) ?? 0);
          pendingBs += Math.max(0, round2(target - paid));
        }
      } else {
        pendingBs += round2(num(t.taxAmountBs));
      }
    }

    return {
      rows,
      summary: {
        count: rows.length,
        taxAmountBs: round2(taxAmountBs),
        paidBs: round2(paidBs),
        pendingBs: round2(pendingBs),
      },
    };
  }

  private async internalNumbersByPayable(ids: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (ids.length === 0) return out;
    const rows = await this.dataSource.query<
      Array<{ payableId: string; internalNumber: string }>
    >(
      `SELECT apo."payableId", iio."internalNumber"
       FROM "accounts_payable_orders" apo
       JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
       WHERE apo."payableId" = ANY($1)
       ORDER BY iio."internalNumber"::int`,
      [ids],
    );
    for (const r of rows) {
      const arr = out.get(r.payableId) ?? [];
      arr.push(r.internalNumber);
      out.set(r.payableId, arr);
    }
    return out;
  }

  private async paidBsByTaxBatch(ids: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (ids.length === 0) return out;
    const rows = await this.dataSource.query<Array<{ batchId: string; paid: string }>>(
      `SELECT l."batchId", COALESCE(SUM(p."amountInBs"), 0)::text AS paid
       FROM "tax_payment_batch_payment_links" l
       JOIN "taxes_payable_payments" p ON p.id = l."paymentId"
       WHERE l."batchId" = ANY($1) AND p."deletedAt" IS NULL
       GROUP BY l."batchId"`,
      [ids],
    );
    for (const r of rows) out.set(r.batchId, num(r.paid));
    return out;
  }

  /** Σ taxAmountBs de TODAS las obligaciones de cada lote SENIAT (sin filtro). */
  private async fullTargetByTaxBatch(ids: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (ids.length === 0) return out;
    const rows = await this.dataSource.query<Array<{ batchId: string; total: string }>>(
      `SELECT tp."taxPaymentBatchId" AS "batchId",
              COALESCE(SUM(tp."taxAmountBs"), 0)::text AS total
       FROM "taxes_payable" tp
       WHERE tp."taxPaymentBatchId" = ANY($1) AND tp."deletedAt" IS NULL
       GROUP BY tp."taxPaymentBatchId"`,
      [ids],
    );
    for (const r of rows) out.set(r.batchId, num(r.total));
    return out;
  }

  // ===========================================================================
  // 3b. ARC — Comprobante de Agente de Retención (Decreto 1.808)
  // Agrupa las retenciones por beneficiario (proveedor) dentro del ejercicio
  // fiscal, con la fecha de abono (pago al proveedor) y lo enterado al SENIAT.
  // ===========================================================================
  async arc(
    query: QueryReportsDto & { year?: string },
    user: AuthenticatedUser,
  ): Promise<{
    period: { from: string; to: string; year: number };
    beneficiaries: Array<{
      providerType: 'doctor' | 'care_center';
      providerId: string | null;
      name: string;
      personType: SeniatPersonType;
      cedula: string | null;
      rif: string | null;
      address: string | null;
      phone: string | null;
      lines: Array<{
        paymentDate: string | null;
        baseBs: number;
        ratePct: number;
        retainedBs: number;
        accBaseBs: number;
        accRetainedBs: number;
        enteradoDate: string | null;
        enteradoBank: string | null;
      }>;
      totalBaseBs: number;
      totalRetainedBs: number;
    }>;
    years: { min: number; max: number };
  }> {
    // Período fiscal: year > from/to > año actual (01-01 a 31-12).
    let year: number;
    let from: string;
    let to: string;
    if (query.year && /^\d{4}$/.test(query.year)) {
      year = Number(query.year);
      from = `${year}-01-01`;
      to = `${year}-12-31`;
    } else if (query.from && query.to) {
      from = query.from;
      to = query.to;
      year = Number(from.slice(0, 4)) || new Date().getFullYear();
    } else {
      year = new Date().getFullYear();
      from = `${year}-01-01`;
      to = `${year}-12-31`;
    }

    // Rango de años seleccionable en FE: de la orden más vieja a la más nueva
    // del sistema (global, sin scope de sucursal). Sin órdenes → año actual.
    const [yearsRow] = await this.dataSource.query<
      Array<{ min: number | null; max: number | null }>
    >(
      `SELECT EXTRACT(YEAR FROM MIN(o."createdAt"))::int AS "min",
              EXTRACT(YEAR FROM MAX(o."createdAt"))::int AS "max"
       FROM "orders" o
       WHERE o."deletedAt" IS NULL`,
    );
    const currentYear = new Date().getFullYear();
    const years = {
      min: yearsRow?.min ?? currentYear,
      max: yearsRow?.max ?? currentYear,
    };

    const empty = { period: { from, to, year }, beneficiaries: [], years };
    const allowed = await this.resolveUserBranchIds(user);
    if (!user.isSuperAdmin && allowed.length === 0) return empty;

    const where: string[] = ['tp."deletedAt" IS NULL'];
    const params: unknown[] = [];
    // Scope de sucursal: la retención cuelga de su lote AP → órdenes → branch.
    if (!user.isSuperAdmin) {
      params.push(allowed);
      where.push(
        `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_s
                 JOIN "order_internal_orders" iio_s ON iio_s.id = apo_s."internalOrderId"
                 JOIN "orders" o_s ON o_s.id = iio_s."orderId"
                 WHERE apo_s."payableId" = tp."sourcePayableId" AND o_s."branchId" = ANY($${params.length}))`,
      );
    }
    if (query.branchId) {
      params.push(query.branchId);
      where.push(
        `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_b
                 JOIN "order_internal_orders" iio_b ON iio_b.id = apo_b."internalOrderId"
                 JOIN "orders" o_b ON o_b.id = iio_b."orderId"
                 WHERE apo_b."payableId" = tp."sourcePayableId" AND o_b."branchId" = $${params.length})`,
      );
    }
    if (query.doctorId) {
      params.push(query.doctorId);
      where.push(`tp."doctorId" = $${params.length}`);
    }
    if (query.careCenterId) {
      params.push(query.careCenterId);
      where.push(`tp."careCenterId" = $${params.length}`);
    }
    params.push(from);
    const pFrom = params.length;
    params.push(to);
    const pTo = params.length;
    where.push(
      `COALESCE(ab.abono::date, tp."createdAt"::date) >= $${pFrom}
       AND COALESCE(ab.abono::date, tp."createdAt"::date) <= $${pTo}`,
    );

    const rows = await this.dataSource.query<
      Array<{
        providerType: 'doctor' | 'care_center';
        providerId: string | null;
        name: string | null;
        personType: SeniatPersonType;
        cedula: string | null;
        rif: string | null;
        address: string | null;
        phone: string | null;
        baseBs: string;
        taxRate: string;
        retainedBs: string;
        abono: string | null;
        createdAt: string;
        enteradoDate: string | null;
        enteradoBank: string | null;
      }>
    >(
      `SELECT tp."recipientType" AS "providerType",
              COALESCE(tp."doctorId", tp."careCenterId") AS "providerId",
              COALESCE(d."firstName" || ' ' || d."lastName", cc."businessName") AS "name",
              tp."personType",
              CASE WHEN tp."recipientType" = 'doctor' AND d."isLegalEntity" = false
                   THEN d."cedula" ELSE NULL END AS "cedula",
              CASE WHEN tp."recipientType" = 'doctor'
                   THEN CASE WHEN d."isLegalEntity" THEN d."rif" ELSE NULL END
                   ELSE cc."rif" END AS "rif",
              COALESCE(d."centerAddress", cc."centerAddress") AS "address",
              COALESCE(
                (SELECT dp."number" FROM "doctor_phones" dp
                  WHERE dp."doctorId" = tp."doctorId"
                  ORDER BY dp."createdAt" LIMIT 1),
                (SELECT cp."number" FROM "care_center_phones" cp
                  WHERE cp."careCenterId" = tp."careCenterId"
                  ORDER BY cp."createdAt" LIMIT 1)
              ) AS "phone",
              tp."grossAmountBs"::text AS "baseBs",
              tp."taxRate"::text AS "taxRate",
              tp."taxAmountBs"::text AS "retainedBs",
              ab.abono::text AS "abono",
              tp."createdAt"::text AS "createdAt",
              en.enterado::text AS "enteradoDate",
              en.bank AS "enteradoBank"
       FROM "taxes_payable" tp
       LEFT JOIN "doctors" d ON d.id = tp."doctorId"
       LEFT JOIN "care_centers" cc ON cc.id = tp."careCenterId"
       LEFT JOIN LATERAL (
         SELECT MAX(app."paymentDate") AS abono
         FROM "accounts_payable_payment_links" apl
         JOIN "accounts_payable_payments" app ON app.id = apl."paymentId"
         WHERE apl."payableId" = tp."sourcePayableId" AND app."deletedAt" IS NULL
       ) ab ON true
       LEFT JOIN LATERAL (
         SELECT MAX(tpp."paymentDate") AS enterado,
                string_agg(DISTINCT NULLIF(COALESCE(bk."name", tpp."bankCode", tpp."referenceNumber"), ''), ', ') AS bank
         FROM "tax_payment_batch_payment_links" tbl
         JOIN "taxes_payable_payments" tpp ON tpp.id = tbl."paymentId"
         LEFT JOIN "banks" bk ON bk."code" = tpp."bankCode"
         WHERE tbl."batchId" = tp."taxPaymentBatchId" AND tpp."deletedAt" IS NULL
       ) en ON true
       WHERE ${where.join(' AND ')}
       ORDER BY "name", COALESCE(ab.abono, tp."createdAt"), tp."createdAt"`,
      params,
    );

    // Agrupar por beneficiario y acumular.
    type Bene = (typeof empty.beneficiaries)[number];
    const map = new Map<string, Bene>();
    for (const r of rows) {
      const key = `${r.providerType}:${r.providerId}`;
      let b = map.get(key);
      if (!b) {
        b = {
          providerType: r.providerType,
          providerId: r.providerId,
          name: r.name ?? '—',
          personType: r.personType,
          cedula: r.cedula,
          rif: r.rif,
          address: r.address,
          phone: r.phone,
          lines: [],
          totalBaseBs: 0,
          totalRetainedBs: 0,
        };
        map.set(key, b);
      }
      const baseBs = round2(num(r.baseBs));
      const retainedBs = round2(num(r.retainedBs));
      b.totalBaseBs = round2(b.totalBaseBs + baseBs);
      b.totalRetainedBs = round2(b.totalRetainedBs + retainedBs);
      b.lines.push({
        paymentDate: r.abono ?? r.createdAt ?? null,
        baseBs,
        ratePct: round2(num(r.taxRate) * 100),
        retainedBs,
        accBaseBs: b.totalBaseBs,
        accRetainedBs: b.totalRetainedBs,
        enteradoDate: r.enteradoDate,
        enteradoBank: r.enteradoBank,
      });
    }

    return { period: { from, to, year }, beneficiaries: Array.from(map.values()), years };
  }

  // ===========================================================================
  // 4. DISBURSEMENTS (dinero pagado a proveedores)
  // ===========================================================================
  async disbursements(
    query: QueryReportsDto,
    user: AuthenticatedUser,
  ): Promise<{ rows: unknown[]; summary: Record<string, number> }> {
    const allowed = await this.resolveUserBranchIds(user);
    if (!user.isSuperAdmin && allowed.length === 0) {
      return { rows: [], summary: { count: 0, totalUsd: 0, totalBs: 0 } };
    }
    const where: string[] = ['p."deletedAt" IS NULL'];
    const params: unknown[] = [];
    // Scope de sucursal: la orden cuelga del lote AP.
    const branchExists = (rateAlias: string) =>
      `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_s
               JOIN "order_internal_orders" iio_s ON iio_s.id = apo_s."internalOrderId"
               JOIN "orders" o_s ON o_s.id = iio_s."orderId"
               WHERE apo_s."payableId" = ap.id AND o_s."branchId" ${rateAlias})`;
    if (!user.isSuperAdmin) {
      params.push(allowed);
      where.push(branchExists(`= ANY($${params.length})`));
    }
    if (query.branchId) {
      params.push(query.branchId);
      where.push(branchExists(`= $${params.length}`));
    }
    if (query.doctorId) {
      params.push(query.doctorId);
      where.push(`ap."doctorId" = $${params.length}`);
    }
    if (query.careCenterId) {
      params.push(query.careCenterId);
      where.push(`ap."careCenterId" = $${params.length}`);
    }
    if (query.from) {
      params.push(query.from);
      where.push(`p."paymentDate" >= $${params.length}`);
    }
    if (query.to) {
      params.push(query.to);
      where.push(`p."paymentDate" <= $${params.length}`);
    }
    if (query.search && query.search.trim()) {
      params.push(`%${query.search.trim().toLowerCase()}%`);
      const n = params.length;
      where.push(
        `(LOWER(ap."payableNumber") LIKE $${n}
          OR LOWER(COALESCE(p."referenceNumber", '')) LIKE $${n}
          OR LOWER(COALESCE(d."firstName" || ' ' || d."lastName", cc."businessName", '')) LIKE $${n})`,
      );
    }

    const rows = await this.dataSource.query<
      Array<{
        paymentId: string;
        paymentDate: string;
        type: string;
        referenceNumber: string | null;
        amountCurrency: string;
        amountValue: string;
        amountInUsd: string;
        amountInBs: string;
        payableNumber: string;
        providerName: string | null;
        providerType: string;
      }>
    >(
      `SELECT p.id AS "paymentId", p."paymentDate", p.type, p."referenceNumber",
              p."amountCurrency", p."amountValue"::text AS "amountValue",
              p."amountInUsd"::text AS "amountInUsd", p."amountInBs"::text AS "amountInBs",
              ap."payableNumber", ap."recipientType" AS "providerType",
              COALESCE(d."firstName" || ' ' || d."lastName", cc."businessName") AS "providerName"
       FROM "accounts_payable_payments" p
       JOIN "accounts_payable_payment_links" l ON l."paymentId" = p.id
       JOIN "accounts_payable" ap ON ap.id = l."payableId"
       LEFT JOIN "doctors" d ON d.id = ap."doctorId"
       LEFT JOIN "care_centers" cc ON cc.id = ap."careCenterId"
       WHERE ${where.join(' AND ')}
       ORDER BY p."paymentDate" DESC, p.id DESC`,
      params,
    );

    let totalUsd = 0;
    let totalBs = 0;
    const out = rows.map((r) => {
      totalUsd += num(r.amountInUsd);
      totalBs += num(r.amountInBs);
      return {
        paymentId: r.paymentId,
        paymentDate: r.paymentDate,
        type: r.type,
        referenceNumber: r.referenceNumber,
        amountCurrency: r.amountCurrency,
        amountValue: round2(num(r.amountValue)),
        amountInUsd: round2(num(r.amountInUsd)),
        amountInBs: round2(num(r.amountInBs)),
        payableNumber: r.payableNumber,
        providerName: r.providerName ?? '—',
        providerType: r.providerType,
      };
    });
    return {
      rows: out,
      summary: { count: out.length, totalUsd: round2(totalUsd), totalBs: round2(totalBs) },
    };
  }

  // ===========================================================================
  // 5. COLLECTIONS (dinero cobrado)
  // ===========================================================================
  async collections(
    query: QueryReportsDto,
    user: AuthenticatedUser,
  ): Promise<{ rows: unknown[]; summary: Record<string, number> }> {
    const allowed = await this.resolveUserBranchIds(user);
    if (!user.isSuperAdmin && allowed.length === 0) {
      return { rows: [], summary: { count: 0, totalUsd: 0, totalBs: 0 } };
    }
    const where: string[] = ['p."deletedAt" IS NULL'];
    const params: unknown[] = [];
    const branchExists = (cmp: string) =>
      `EXISTS (SELECT 1 FROM "accounts_receivable_orders" aro_s
               JOIN "orders" o_s ON o_s.id = aro_s."orderId"
               WHERE aro_s."receivableId" = ar.id AND o_s."branchId" ${cmp})`;
    if (!user.isSuperAdmin) {
      params.push(allowed);
      where.push(branchExists(`= ANY($${params.length})`));
    }
    if (query.branchId) {
      params.push(query.branchId);
      where.push(branchExists(`= $${params.length}`));
    }
    if (query.insuranceId) {
      params.push(query.insuranceId);
      where.push(`ar."insuranceId" = $${params.length}`);
    }
    if (query.holderId) {
      params.push(query.holderId);
      where.push(`ar."holderId" = $${params.length}`);
    }
    if (query.from) {
      params.push(query.from);
      where.push(`p."paymentDate" >= $${params.length}`);
    }
    if (query.to) {
      params.push(query.to);
      where.push(`p."paymentDate" <= $${params.length}`);
    }
    if (query.search && query.search.trim()) {
      params.push(`%${query.search.trim().toLowerCase()}%`);
      const n = params.length;
      where.push(
        `(LOWER(ar."receivableNumber") LIKE $${n}
          OR LOWER(COALESCE(p."referenceNumber", '')) LIKE $${n}
          OR LOWER(COALESCE(i."name", '')) LIKE $${n}
          OR LOWER(COALESCE(h."firstName" || ' ' || h."lastName", h."businessName", '')) LIKE $${n})`,
      );
    }

    const rows = await this.dataSource.query<
      Array<{
        paymentId: string;
        paymentDate: string;
        type: string;
        referenceNumber: string | null;
        amountCurrency: string;
        amountValue: string;
        amountInUsd: string;
        amountInBs: string;
        receivableNumber: string;
        debtorName: string | null;
        debtorType: string;
      }>
    >(
      `SELECT p.id AS "paymentId", p."paymentDate", p.type, p."referenceNumber",
              p."amountCurrency", p."amountValue"::text AS "amountValue",
              p."amountInUsd"::text AS "amountInUsd", p."amountInBs"::text AS "amountInBs",
              ar."receivableNumber",
              CASE WHEN ar."insuranceId" IS NOT NULL THEN 'insurance'
                   WHEN ar."holderId" IS NOT NULL THEN 'holder'
                   ELSE 'cashea' END AS "debtorType",
              COALESCE(i."name", h."businessName", h."firstName" || ' ' || h."lastName",
                       CASE WHEN ar."insuranceId" IS NULL AND ar."holderId" IS NULL THEN 'Cashea' END
              ) AS "debtorName"
       FROM "accounts_receivable_payments" p
       JOIN "accounts_receivable_payment_links" l ON l."paymentId" = p.id
       JOIN "accounts_receivable" ar ON ar.id = l."receivableId"
       LEFT JOIN "insurances" i ON i.id = ar."insuranceId"
       LEFT JOIN "patients" h ON h.id = ar."holderId"
       WHERE ${where.join(' AND ')}
       ORDER BY p."paymentDate" DESC, p.id DESC`,
      params,
    );

    let totalUsd = 0;
    let totalBs = 0;
    const out = rows.map((r) => {
      totalUsd += num(r.amountInUsd);
      totalBs += num(r.amountInBs);
      return {
        paymentId: r.paymentId,
        paymentDate: r.paymentDate,
        type: r.type,
        referenceNumber: r.referenceNumber,
        amountCurrency: r.amountCurrency,
        amountValue: round2(num(r.amountValue)),
        amountInUsd: round2(num(r.amountInUsd)),
        amountInBs: round2(num(r.amountInBs)),
        receivableNumber: r.receivableNumber,
        debtorName: r.debtorName ?? '—',
        debtorType: r.debtorType,
      };
    });
    return {
      rows: out,
      summary: { count: out.length, totalUsd: round2(totalUsd), totalBs: round2(totalBs) },
    };
  }

  // ===========================================================================
  // 6. AGING (antigüedad de saldos pendientes)
  // ===========================================================================
  async aging(
    query: QueryReportsDto,
    user: AuthenticatedUser,
  ): Promise<{
    rows: { payable: unknown[]; receivable: unknown[] };
    summary: Record<string, number>;
  }> {
    // Reusa los reportes per-obligación (que ya incluyen Pendientes) y agrupa por
    // bucket de antigüedad de orderDate.
    const payablesRes = await this.payables({ ...query, groupBy: undefined }, user);
    const receivablesRes = await this.receivables({ ...query, groupBy: undefined }, user);

    const fallbackRateBs = await this.fallbackUsdRateBs();
    // Edad en días CALENDARIO: fecha-solo vs fecha-solo (ambas ancladas a
    // medianoche UTC). Comparar contra el instante actual corría el bucket +1
    // durante las últimas horas del día según la TZ del servidor.
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const bucketOf = (orderDate: string | Date): '0-30' | '31-60' | '61-90' | '90+' => {
      const iso =
        orderDate instanceof Date ? orderDate.toISOString() : String(orderDate);
      const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
      if (!y || !m || !d) return '0-30';
      const days = Math.max(0, Math.round((todayUtc - Date.UTC(y, m - 1, d)) / 86_400_000));
      if (days <= 30) return '0-30';
      if (days <= 60) return '31-60';
      if (days <= 90) return '61-90';
      return '90+';
    };

    // ---- Payable buckets (Bs): obligaciones cuyo lote ≠ pagado o sin lote ----
    const payableBuckets = this.emptyBuckets();
    for (const row of payablesRes.rows as Array<{
      state: string;
      netBs: number;
      orderDate: string;
    }>) {
      if (row.state === 'paid') continue; // ya saldado
      const b = bucketOf(row.orderDate);
      payableBuckets[b].count += 1;
      payableBuckets[b].amountBs += row.netBs;
    }

    // ---- Receivable buckets: órdenes no-cobradas o sin lote (USD + Bs) ----
    const receivableBuckets = this.emptyBuckets();
    for (const row of receivablesRes.rows as Array<{
      state: string;
      targetUsd: number | null;
      targetBs: number | null;
      useFixedRate: boolean;
      orderDate: string;
    }>) {
      if (row.state === 'collected' || row.state === 'overcollected') continue;
      const b = bucketOf(row.orderDate);
      receivableBuckets[b].count += 1;
      if (row.useFixedRate) {
        receivableBuckets[b].amountBs += num(row.targetBs);
        receivableBuckets[b].amountUsd += num(row.targetBs) / (fallbackRateBs || 1);
      } else {
        receivableBuckets[b].amountUsd += num(row.targetUsd);
        receivableBuckets[b].amountBs += num(row.targetUsd) * fallbackRateBs;
      }
    }

    const toRows = (buckets: ReturnType<ReportsService['emptyBuckets']>) =>
      (['0-30', '31-60', '61-90', '90+'] as const).map((bucket) => ({
        bucket,
        count: buckets[bucket].count,
        amountUsd: round2(buckets[bucket].amountUsd),
        amountBs: round2(buckets[bucket].amountBs),
      }));

    const payableRows = toRows(payableBuckets);
    const receivableRows = toRows(receivableBuckets);
    return {
      rows: { payable: payableRows, receivable: receivableRows },
      summary: {
        payablePendingBs: round2(payableRows.reduce((s, r) => s + r.amountBs, 0)),
        receivablePendingUsd: round2(receivableRows.reduce((s, r) => s + r.amountUsd, 0)),
        receivablePendingBs: round2(receivableRows.reduce((s, r) => s + r.amountBs, 0)),
      },
    };
  }

  private emptyBuckets() {
    return {
      '0-30': { count: 0, amountUsd: 0, amountBs: 0 },
      '31-60': { count: 0, amountUsd: 0, amountBs: 0 },
      '61-90': { count: 0, amountUsd: 0, amountBs: 0 },
      '90+': { count: 0, amountUsd: 0, amountBs: 0 },
    };
  }
}
