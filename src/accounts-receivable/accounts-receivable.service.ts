import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AccountsReceivable } from './entities/accounts-receivable.entity';
import { AccountsReceivablePayment } from './entities/accounts-receivable-payment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import {
  AccountsReceivablePaymentDto,
  CreateAccountsReceivableBatchDto,
  QueryAccountsReceivableDto,
  QueryPendingReceivableDto,
} from './dto/register-collection.dto';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  computeAmountInBs,
  computeAmountInUsd,
} from '../shared/utils/payment-conversion';
import { Order } from '../orders/entities/order.entity';
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service';
import {
  splitOrderPortionsUsd,
  targetBsForOrder,
  targetBsForPortion,
  targetUsdForOrder,
} from './ar-targets';
import type { AroPortion } from './entities/accounts-receivable-order.entity';

// Re-export para compatibilidad con specs/consumidores existentes.
export {
  casheaCommissionForOrder,
  casheaFinancingForOrder,
  targetUsdForOrder,
  targetBsForOrder,
} from './ar-targets';

const TOLERANCE_USD = 0.01;
const TOLERANCE_BS = 0.01;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Agregados del pivot de un lote, resueltos en SQL (1 query por página). */
interface ReceivableOrderTotals {
  orderCount: number;
  /** ¿Alguna orden del lote cobra a tasa fija? ⇒ el lote va en modo `fixed`. */
  anyFixed: boolean;
  /** Σ `targetBs` del pivot. */
  targetBs: number;
  /** Σ `targetUsd` del pivot. */
  targetUsd: number;
}

/**
 * Orden finalizada con deudor, disponible para armar un lote (Pendiente).
 * Una orden mixta (seguro no indexado + STs indexados) genera 2 pendientes:
 * `portion='fixed'` (Bs tasa fija) y `portion='indexed'` (USD, tasa del cobro);
 * `useFixedRate` refleja el modo de la PORCIÓN, no el de la orden.
 */
export interface PendingReceivable {
  orderId: string;
  orderNumber: string;
  orderType: string;
  portion: AroPortion;
  debtorType: 'insurance' | 'holder' | 'cashea';
  insuranceId: string | null;
  holderId: string | null;
  debtorName: string;
  useFixedRate: boolean;
  targetUsd: number | null;
  targetBs: number | null;
  branchId: string;
  branchName: string | null;
  createdAt: string;
}

/**
 * Condiciones SQL de expansión por porciones. Emite por orden:
 *  - `full` si no es tasa fija o no tiene STs indexados (caso normal),
 *  - `indexed` si es tasa fija con STs indexados,
 *  - `fixed` además si la porción indexada no cubre el total.
 */
const PORTION_EMIT_SQL = `(
  (pt.portion = 'full' AND (o."useFixedRate" = false OR ix."indexedUsd" <= 0))
  OR (pt.portion = 'indexed' AND o."useFixedRate" = true AND ix."indexedUsd" > 0)
  OR (pt.portion = 'fixed' AND o."useFixedRate" = true AND ix."indexedUsd" > 0
      AND ix."indexedUsd" < o."priceAmount")
)`;

/** LATERAL: porción indexada (USD) = Σ precio snapshot seguro × cantidad de STs indexados. */
const INDEXED_USD_LATERAL_SQL = `CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(ROUND(osp."priceUsd" * ost."quantity", 2)), 0) AS "indexedUsd"
  FROM "order_service_types" ost
  JOIN "order_service_pricing" osp
    ON osp."orderId" = ost."orderId"
   AND osp."serviceTypeId" = ost."serviceTypeId"
   AND osp."kind" = 'insurance'
  WHERE ost."orderId" = o.id AND ost."isIndexed" = true
) ix
CROSS JOIN LATERAL (VALUES ('full'), ('fixed'), ('indexed')) pt(portion)`;

@Injectable()
export class AccountsReceivableService {
  constructor(
    @InjectRepository(AccountsReceivable)
    private readonly repo: Repository<AccountsReceivable>,
    @InjectRepository(AccountsReceivablePayment)
    private readonly paymentsRepo: Repository<AccountsReceivablePayment>,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(ExchangeRate)
    private readonly ratesRepo: Repository<ExchangeRate>,
    private readonly dataSource: DataSource,
    private readonly paymentAccounts: PaymentAccountsService,
  ) {
    void this.paymentsRepo;
    void this.banksRepo;
  }

  private async resolveUserBranchIds(
    user: AuthenticatedUser,
  ): Promise<string[]> {
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

  // ---------------------------------------------------------------------------
  // Pendientes.
  // ---------------------------------------------------------------------------
  async listPending(
    query: QueryPendingReceivableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<PendingReceivable>> {
    const {
      page = 1,
      limit = 10,
      search,
      debtorType,
      insuranceId,
      holderId,
      branchId,
    } = query;
    const params: unknown[] = [];
    const where: string[] = [
      `o.status = 'finalized'`,
      `o."deletedAt" IS NULL`,
      `((o."type" = 'insurance' AND o."insuranceId" IS NOT NULL)
        OR (o."type" IN ('credit','cashea') AND o."holderId" IS NOT NULL))`,
      PORTION_EMIT_SQL,
      // Exclusión por porción: 'full' bloquea todo; una porción bloquea su igual.
      `NOT EXISTS (SELECT 1 FROM "accounts_receivable_orders" aro
        WHERE aro."orderId" = o.id
          AND (aro."portion" = pt.portion OR aro."portion" = 'full' OR pt.portion = 'full'))`,
    ];

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0)
        return { data: [], metadata: { total: 0, page, lastPage: 1 } };
      params.push(allowed);
      where.push(`o."branchId" = ANY($${params.length})`);
    }
    if (debtorType === 'insurance') where.push(`o."type" = 'insurance'`);
    if (debtorType === 'holder') where.push(`o."type" = 'credit'`);
    if (debtorType === 'cashea') where.push(`o."type" = 'cashea'`);
    if (insuranceId) {
      params.push(insuranceId);
      where.push(`o."insuranceId" = $${params.length}`);
    }
    if (holderId) {
      params.push(holderId);
      where.push(`o."holderId" = $${params.length}`);
    }
    if (branchId) {
      params.push(branchId);
      where.push(`o."branchId" = $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const n = params.length;
      where.push(
        `(LOWER(o."orderNumber") LIKE $${n}
          OR LOWER(COALESCE(i."name", '')) LIKE $${n}
          OR LOWER(COALESCE(p."firstName", '')) LIKE $${n}
          OR LOWER(COALESCE(p."lastName", '')) LIKE $${n}
          OR LOWER(COALESCE(p."businessName", '')) LIKE $${n})`,
      );
    }

    const whereSql = where.join(' AND ');
    const countRows = await this.dataSource.query<{ c: string }[]>(
      `SELECT count(*)::int AS c FROM "orders" o
       LEFT JOIN "insurances" i ON i.id = o."insuranceId"
       LEFT JOIN "patients" p ON p.id = o."holderId"
       ${INDEXED_USD_LATERAL_SQL}
       WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.c ?? 0);
    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];
    const rows = await this.dataSource.query<
      Array<{
        orderId: string;
        orderNumber: string;
        orderType: string;
        insuranceId: string | null;
        holderId: string | null;
        insuranceName: string | null;
        firstName: string | null;
        lastName: string | null;
        businessName: string | null;
        cedula: string | null;
        rif: string | null;
        useFixedRate: boolean;
        priceAmount: string;
        casheaFirstInstallmentAmount: string | null;
        casheaCommissionRate: string | null;
        casheaFinancingRate: string | null;
        fixedRateBs: string | null;
        portion: AroPortion;
        indexedUsd: string;
        branchId: string;
        branchName: string | null;
        createdAt: string;
      }>
    >(
      `SELECT o.id AS "orderId", o."orderNumber", o."type" AS "orderType",
              o."insuranceId", o."holderId", i."name" AS "insuranceName",
              p."firstName", p."lastName", p."businessName", p."cedula", p."rif",
              o."useFixedRate", o."priceAmount",
              o."casheaFirstInstallmentAmount", o."casheaCommissionRate", o."casheaFinancingRate",
              fx."amountBs" AS "fixedRateBs",
              pt.portion AS "portion", ix."indexedUsd"::text AS "indexedUsd",
              o."branchId", b."name" AS "branchName", o."createdAt"
       FROM "orders" o
       LEFT JOIN "insurances" i ON i.id = o."insuranceId"
       LEFT JOIN "patients" p ON p.id = o."holderId"
       LEFT JOIN "branches" b ON b.id = o."branchId"
       LEFT JOIN "exchange_rates" fx ON fx.id = o."fixedExchangeRateId"
       ${INDEXED_USD_LATERAL_SQL}
       WHERE ${whereSql}
       ORDER BY o."orderNumber"::int DESC, pt.portion
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    const data: PendingReceivable[] = rows.map((r) => {
      const orderLike = {
        type: r.orderType,
        priceAmount: r.priceAmount,
        casheaFirstInstallmentAmount: r.casheaFirstInstallmentAmount,
        casheaCommissionRate: r.casheaCommissionRate,
        casheaFinancingRate: r.casheaFinancingRate,
        useFixedRate: r.useFixedRate,
        fixedExchangeRate:
          r.fixedRateBs != null ? { amountBs: r.fixedRateBs } : null,
      } as unknown as Order;
      const debtorType: 'insurance' | 'holder' | 'cashea' =
        r.orderType === 'insurance'
          ? 'insurance'
          : r.orderType === 'cashea'
            ? 'cashea'
            : 'holder';
      // Cashea: el deudor es la fintech, pero mostramos el titular como referencia.
      const debtorName =
        debtorType === 'insurance'
          ? (r.insuranceName ?? '—')
          : (r.businessName ??
            (`${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '—'));
      // Targets por porción: 'full' = orden completa; 'fixed' = resto no
      // indexado en Bs a la tasa de la orden; 'indexed' = STs indexados en USD.
      const price = Number(r.priceAmount) || 0;
      const indexedUsd = Math.min(Number(r.indexedUsd) || 0, price);
      const fixedUsd = Math.max(0, round2(price - indexedUsd));
      const rateBs = Number(r.fixedRateBs);
      let rowUseFixedRate = r.useFixedRate;
      let targetUsd: number | null = null;
      let targetBs: number | null = null;
      if (r.portion === 'indexed') {
        rowUseFixedRate = false;
        targetUsd = indexedUsd;
      } else if (r.portion === 'fixed') {
        rowUseFixedRate = true;
        targetBs = Number.isFinite(rateBs) ? round2(fixedUsd * rateBs) : null;
      } else {
        targetUsd = r.useFixedRate ? null : targetUsdForOrder(orderLike);
        targetBs = r.useFixedRate ? targetBsForOrder(orderLike) : null;
      }
      return {
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        orderType: r.orderType,
        portion: r.portion,
        debtorType,
        insuranceId: r.insuranceId,
        holderId: r.holderId,
        debtorName,
        useFixedRate: rowUseFixedRate,
        targetUsd,
        targetBs,
        branchId: r.branchId,
        branchName: r.branchName,
        createdAt: r.createdAt,
      };
    });

    return {
      data,
      metadata: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Lotes.
  // ---------------------------------------------------------------------------
  async listBatches(
    query: QueryAccountsReceivableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<AccountsReceivable>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      insuranceId,
      holderId,
      debtorType,
      branchId,
      sortBy = 'createdAt',
      sortDir = 'DESC',
    } = query;

    // Paginado en dos pasos. Paso 1: filtrar/ordenar sobre `accounts_receivable`
    // sola — los únicos joins son ManyToOne (no multiplican filas) y sólo para
    // buscar por nombre de deudor — para que LIMIT/OFFSET y COUNT trabajen
    // sobre índices y no sobre el cartesiano lote×órdenes×pagos.
    const qb = this.repo.createQueryBuilder('ar');
    if (search && search.trim()) {
      qb.leftJoin('ar.insurance', 'insurance').leftJoin('ar.holder', 'holder');
    }

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else
        qb.andWhere(
          `EXISTS (SELECT 1 FROM "accounts_receivable_orders" aro2
                   JOIN "orders" o2 ON o2.id = aro2."orderId"
                   WHERE aro2."receivableId" = ar.id AND o2."branchId" IN (:...allowed))`,
          { allowed },
        );
    }
    if (status) qb.andWhere('ar.status = :status', { status });
    if (insuranceId)
      qb.andWhere('ar.insuranceId = :insuranceId', { insuranceId });
    if (holderId) qb.andWhere('ar.holderId = :holderId', { holderId });
    if (debtorType === 'insurance') qb.andWhere('ar.insuranceId IS NOT NULL');
    if (debtorType === 'holder') qb.andWhere('ar.holderId IS NOT NULL');
    if (debtorType === 'cashea')
      qb.andWhere('ar.insuranceId IS NULL AND ar.holderId IS NULL');
    if (branchId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "accounts_receivable_orders" aro3
                 JOIN "orders" o3 ON o3.id = aro3."orderId"
                 WHERE aro3."receivableId" = ar.id AND o3."branchId" = :branchId)`,
        { branchId },
      );
    }
    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(ar."receivableNumber") LIKE :s
          OR LOWER(COALESCE(insurance."name", '')) LIKE :s
          OR LOWER(COALESCE(holder."firstName", '')) LIKE :s
          OR LOWER(COALESCE(holder."lastName", '')) LIKE :s
          OR LOWER(COALESCE(holder."businessName", '')) LIKE :s
          OR EXISTS (SELECT 1 FROM "accounts_receivable_orders" aro4
                     JOIN "orders" o4 ON o4.id = aro4."orderId"
                     WHERE aro4."receivableId" = ar.id AND LOWER(o4."orderNumber") LIKE :s))`,
        { s },
      );
    }

    const total = await qb.getCount();
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const ids = (
      await qb
        .select('ar.id', 'id')
        // `id` como desempate (en la misma dirección que el sort, para que el
        // índice compuesto sirva en ASC y en DESC): el orden es estable entre
        // páginas aunque dos lotes compartan `createdAt`.
        .orderBy(`ar.${sortBy}`, sortDir)
        .addOrderBy('ar.id', sortDir)
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<{ id: string }>()
    ).map((r) => r.id);
    if (ids.length === 0)
      return { data: [], metadata: { total, page, lastPage } };

    // Paso 2: hidratar sólo la página. El pivot no se trae: modo, nº de órdenes
    // y objetivos salen de una única query agrupada.
    const [rows, totals] = await Promise.all([
      this.repo.find({
        where: { id: In(ids) },
        relations: {
          insurance: true,
          holder: true,
          payments: { exchangeRate: true },
        },
      }),
      this.orderTotals(ids),
    ]);
    const byId = new Map(rows.map((b) => [b.id, b]));
    const data = ids
      .map((id) => byId.get(id))
      .filter((b): b is AccountsReceivable => !!b);
    for (const b of data) this.computeFigures(b, totals.get(b.id));
    return { data, metadata: { total, page, lastPage } };
  }

  /**
   * Agregados del pivot de varios lotes en una sola query: nº de órdenes, modo
   * de cobro y objetivos en Bs/USD.
   */
  private async orderTotals(
    ids: string[],
  ): Promise<Map<string, ReceivableOrderTotals>> {
    const rows = await this.dataSource.query<
      Array<{
        receivableId: string;
        orderCount: string;
        anyFixed: boolean;
        targetBs: string;
        targetUsd: string;
      }>
    >(
      `SELECT aro."receivableId",
              COUNT(*) AS "orderCount",
              COALESCE(BOOL_OR(aro."useFixedRate"), false) AS "anyFixed",
              COALESCE(SUM(aro."targetBs"), 0) AS "targetBs",
              COALESCE(SUM(aro."targetUsd"), 0) AS "targetUsd"
       FROM "accounts_receivable_orders" aro
       WHERE aro."receivableId" = ANY($1)
       GROUP BY aro."receivableId"`,
      [ids],
    );
    return new Map(
      rows.map((r) => [
        r.receivableId,
        {
          orderCount: Number(r.orderCount) || 0,
          anyFixed: !!r.anyFixed,
          targetBs: Number(r.targetBs) || 0,
          targetUsd: Number(r.targetUsd) || 0,
        },
      ]),
    );
  }

  async findOneBatch(
    id: string,
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch)
      throw new NotFoundException('Lote de cuentas por cobrar no encontrado');
    await this.assertVisibility(batch, user);
    this.computeFigures(batch);
    return batch;
  }

  private loadBatch(
    mgr: EntityManager,
    id: string,
  ): Promise<AccountsReceivable | null> {
    return mgr.findOne(AccountsReceivable, {
      where: { id },
      relations: {
        insurance: true,
        holder: { phones: true },
        // Autor del ajuste del total (card "Ajuste" del detalle).
        adjustedBy: true,
        // holder/patient/fixedExchangeRate de cada orden: los usa el estado de
        // cuenta Excel del lote de seguro en el FE.
        orders: {
          order: {
            branch: true,
            holder: true,
            patient: true,
            fixedExchangeRate: true,
          },
        },
        payments: { exchangeRate: true },
      },
    });
  }

  private async assertVisibility(
    batch: AccountsReceivable,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = new Set(await this.resolveUserBranchIds(user));
    const branchIds = (batch.orders ?? [])
      .map((o) => o.order?.branchId)
      .filter(Boolean) as string[];
    if (branchIds.length === 0 || branchIds.some((b) => !allowed.has(b))) {
      throw new ForbiddenException('No tienes acceso a este lote');
    }
  }

  private computeFigures(
    batch: AccountsReceivable,
    totals?: ReceivableOrderTotals,
  ): void {
    // Listado: el pivot no viene hidratado, los agregados llegan de SQL.
    const pivots = batch.orders ?? [];
    const mode: 'usd' | 'fixed' = (
      totals ? totals.anyFixed : pivots.some((o) => o.useFixedRate)
    )
      ? 'fixed'
      : 'usd';
    batch.mode = mode;
    batch.orderCount = totals ? totals.orderCount : pivots.length;
    // Ajuste firmado en la moneda del lote (negativo resta, positivo suma).
    // El target efectivo nunca baja de 0.
    const adjustment = round2(Number(batch.adjustmentAmount ?? 0) || 0);
    if (mode === 'fixed') {
      const baseBs = round2(
        totals
          ? totals.targetBs
          : pivots.reduce((s, o) => s + Number(o.targetBs || 0), 0),
      );
      const targetBs = Math.max(0, round2(baseBs + adjustment));
      const collectedBs = round2(
        (batch.payments ?? []).reduce(
          (s, p) => s + Number(p.amountInBs || 0),
          0,
        ),
      );
      batch.targetBaseBs = baseBs;
      batch.targetBs = targetBs;
      batch.collectedBs = collectedBs;
      batch.pendingBs = Math.max(0, round2(targetBs - collectedBs));
    } else {
      const baseUsd = round2(
        totals
          ? totals.targetUsd
          : pivots.reduce((s, o) => s + Number(o.targetUsd || 0), 0),
      );
      const targetUsd = Math.max(0, round2(baseUsd + adjustment));
      const collectedUsd = round2(
        (batch.payments ?? []).reduce(
          (s, p) => s + Number(p.amountInUsd || 0),
          0,
        ),
      );
      batch.targetBaseUsd = baseUsd;
      batch.targetUsd = targetUsd;
      batch.collectedUsd = collectedUsd;
      batch.pendingUsd = Math.max(0, round2(targetUsd - collectedUsd));
    }
  }

  /**
   * Ajusta (resta o suma) el total a cobrar del lote. Pensado para seguros que
   * pagan menos de lo facturado: con el ajuste el lote puede quedar `collected`
   * sin sobre/sub-cobro artificial. El monto va en la moneda del lote (Bs en
   * modo tasa fija, USD en modo USD); `amount = 0` limpia el ajuste. Espeja el
   * ajuste de monto del Paso 1: con ajuste ≠ 0 el motivo es obligatorio y queda
   * el autor + la fecha.
   */
  async setAdjustment(
    id: string,
    amount: number,
    note: string | undefined,
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);

    const value = round2(Number(amount) || 0);
    if (!Number.isFinite(value)) {
      throw new BadRequestException('Monto del ajuste inválido');
    }
    const trimmed = (note ?? '').trim();
    const clear = Math.abs(value) < 0.005;
    if (!clear && trimmed.length < 3) {
      throw new BadRequestException(
        'Indica el motivo del ajuste (mínimo 3 caracteres)',
      );
    }
    // El ajuste no puede dejar el total a cobrar en negativo.
    this.computeFigures(batch);
    const base =
      batch.mode === 'fixed'
        ? (batch.targetBaseBs ?? 0)
        : (batch.targetBaseUsd ?? 0);
    if (!clear && round2(base + value) < 0) {
      throw new BadRequestException(
        'El ajuste no puede dejar el total a cobrar en negativo',
      );
    }

    await this.dataSource.transaction(async (mgr) => {
      await mgr.update(AccountsReceivable, id, {
        adjustmentAmount: clear ? null : value.toFixed(2),
        adjustmentNote: clear ? null : trimmed,
        adjustedById: clear ? null : user.id,
        adjustedAt: clear ? null : new Date(),
      });
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  // ---------------------------------------------------------------------------
  // Crear / mutar lote.
  // ---------------------------------------------------------------------------
  async createBatch(
    dto: CreateAccountsReceivableBatchDto,
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    // Cashea: el deudor es la fintech (sin insuranceId/holderId en el lote).
    const debtorId =
      dto.debtorType === 'insurance'
        ? dto.insuranceId
        : dto.debtorType === 'holder'
          ? dto.holderId
          : null;
    if (dto.debtorType !== 'cashea' && !debtorId) {
      throw new BadRequestException(
        `Falta ${dto.debtorType === 'insurance' ? 'insuranceId' : 'holderId'}`,
      );
    }
    const rows = await this.validatePendingOrders(dto.orderIds, dto, user);

    const id = await this.dataSource.transaction(async (mgr) => {
      const seq = await mgr.query<{ nextval: string }[]>(
        `SELECT nextval('accounts_receivable_seq') AS nextval`,
      );
      const inserted = await mgr.query<{ id: string }[]>(
        `INSERT INTO "accounts_receivable" ("receivableNumber", "insuranceId", "holderId", "status")
         VALUES ($1, $2, $3, 'uncollected') RETURNING id`,
        [
          String(seq[0].nextval),
          dto.debtorType === 'insurance' ? debtorId : null,
          dto.debtorType === 'holder' ? debtorId : null, // cashea → ambos NULL
        ],
      );
      const batchId = inserted[0].id;
      for (const r of rows) {
        await mgr.query(
          `INSERT INTO "accounts_receivable_orders"
             ("receivableId", "orderId", "portion", "useFixedRate", "targetUsd", "targetBs")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            batchId,
            r.orderId,
            r.portion,
            r.useFixedRate,
            r.targetUsd != null ? r.targetUsd.toFixed(2) : null,
            r.targetBs != null ? r.targetBs.toFixed(2) : null,
          ],
        );
      }
      return batchId;
    });

    return this.findOneBatch(id, user);
  }

  async addOrders(
    id: string,
    orderIds: string[],
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (batch.status === 'collected' || batch.status === 'overcollected') {
      throw new BadRequestException(
        'No se pueden agregar órdenes a un lote ya cobrado. Edita o quita un cobro primero.',
      );
    }
    const debtorType: 'insurance' | 'holder' | 'cashea' = batch.insuranceId
      ? 'insurance'
      : batch.holderId
        ? 'holder'
        : 'cashea';
    const dtoLike = {
      debtorType,
      insuranceId: batch.insuranceId ?? undefined,
      holderId: batch.holderId ?? undefined,
    } as CreateAccountsReceivableBatchDto;
    const existingMode: 'usd' | 'fixed' = (batch.orders ?? []).some(
      (o) => o.useFixedRate,
    )
      ? 'fixed'
      : 'usd';
    const rows = await this.validatePendingOrders(
      orderIds,
      dtoLike,
      user,
      existingMode,
    );
    await this.dataSource.transaction(async (mgr) => {
      for (const r of rows) {
        await mgr.query(
          `INSERT INTO "accounts_receivable_orders"
             ("receivableId", "orderId", "portion", "useFixedRate", "targetUsd", "targetBs")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            r.orderId,
            r.portion,
            r.useFixedRate,
            r.targetUsd != null ? r.targetUsd.toFixed(2) : null,
            r.targetBs != null ? r.targetBs.toFixed(2) : null,
          ],
        );
      }
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async removeOrders(
    id: string,
    orderIds: string[],
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    const remaining = (batch.orders ?? []).filter(
      (o) => !orderIds.includes(o.orderId),
    );
    if (remaining.length === 0) {
      throw new BadRequestException(
        'El lote quedaría vacío. Elimina el lote en su lugar.',
      );
    }
    await this.dataSource.transaction(async (mgr) => {
      await mgr.query(
        `DELETE FROM "accounts_receivable_orders" WHERE "receivableId" = $1 AND "orderId" = ANY($2)`,
        [id, orderIds],
      );
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  /**
   * Valida órdenes pendientes: existencia, finalizada, deudor uniforme, modo
   * uniforme, sin lote (por porción), visible. Una orden mixta (tasa fija +
   * STs indexados) aporta la porción que corresponde al modo del lote: `fixed`
   * → porción fija (Bs), `usd` → porción indexada (USD).
   */
  private async validatePendingOrders(
    orderIds: string[],
    dto: CreateAccountsReceivableBatchDto,
    user: AuthenticatedUser,
    forcedMode?: 'usd' | 'fixed',
  ): Promise<
    Array<{
      orderId: string;
      portion: AroPortion;
      useFixedRate: boolean;
      targetUsd: number | null;
      targetBs: number | null;
    }>
  > {
    const orders = await this.ordersRepo.find({
      where: { id: In(orderIds) },
      relations: {
        fixedExchangeRate: true,
        orderServiceTypes: true,
        servicePricing: true,
      },
    });
    if (orders.length !== orderIds.length) {
      throw new BadRequestException('Alguna orden no existe');
    }
    const inBatch = await this.dataSource.query<
      { orderId: string; portion: AroPortion }[]
    >(
      `SELECT "orderId", "portion" FROM "accounts_receivable_orders" WHERE "orderId" = ANY($1)`,
      [orderIds],
    );
    const portionsInBatch = new Map<string, Set<AroPortion>>();
    for (const r of inBatch) {
      const set = portionsInBatch.get(r.orderId) ?? new Set<AroPortion>();
      set.add(r.portion);
      portionsInBatch.set(r.orderId, set);
    }
    let allowed: Set<string> | null = null;
    if (!user.isSuperAdmin)
      allowed = new Set(await this.resolveUserBranchIds(user));

    // Porción natural de cada orden ('full' si no hay mezcla; null = mixta,
    // depende del modo del lote).
    const naturalPortion = (o: Order): AroPortion | null => {
      if (!o.useFixedRate) return 'full';
      const { fixedUsd, indexedUsd } = splitOrderPortionsUsd(o);
      if (indexedUsd <= 0) return 'full';
      if (fixedUsd <= 0) return 'indexed'; // toda la orden indexada → USD
      return null; // mixta
    };

    // Modo del lote: forzado (add), pedido en el DTO (create) o inferido de la
    // primera orden no mixta. Con sólo órdenes mixtas es obligatorio indicarlo.
    let mode: 'usd' | 'fixed' | undefined = forcedMode ?? dto.mode;
    if (!mode) {
      for (const o of orders) {
        const p = naturalPortion(o);
        if (p === 'full') {
          mode = o.useFixedRate ? 'fixed' : 'usd';
          break;
        }
        if (p === 'indexed') {
          mode = 'usd';
          break;
        }
      }
    }
    if (!mode) {
      throw new BadRequestException(
        'Indica el modo del lote (tasa fija o USD) para órdenes con servicios indexados',
      );
    }

    const debtorId =
      dto.debtorType === 'insurance' ? dto.insuranceId : dto.holderId;
    const out: Array<{
      orderId: string;
      portion: AroPortion;
      useFixedRate: boolean;
      targetUsd: number | null;
      targetBs: number | null;
    }> = [];
    for (const o of orders) {
      if (o.status !== 'finalized') {
        throw new BadRequestException(
          'Sólo se pueden cobrar órdenes finalizadas',
        );
      }
      if (allowed && !allowed.has(o.branchId)) {
        throw new ForbiddenException('No tienes acceso a una de las órdenes');
      }
      // Deudor uniforme. Cashea: basta que la orden sea cashea (el deudor es la
      // fintech; puede mezclar titulares distintos).
      const oDebtorType: 'insurance' | 'holder' | 'cashea' =
        o.type === 'insurance'
          ? 'insurance'
          : o.type === 'cashea'
            ? 'cashea'
            : 'holder';
      if (oDebtorType !== dto.debtorType) {
        throw new BadRequestException(
          'Todas las órdenes del lote deben ser del mismo tipo de deudor',
        );
      }
      if (dto.debtorType !== 'cashea') {
        const oDebtorId =
          oDebtorType === 'insurance' ? o.insuranceId : o.holderId;
        if (oDebtorId !== debtorId) {
          throw new BadRequestException(
            'Todas las órdenes del lote deben ser del mismo deudor seleccionado',
          );
        }
      }

      // Porción que entra al lote + fila snapshot.
      const natural = naturalPortion(o);
      const portion: AroPortion =
        natural ?? (mode === 'fixed' ? 'fixed' : 'indexed');
      const rowFixed =
        portion === 'full' ? o.useFixedRate : portion === 'fixed';
      // Modo uniforme (la porción debe calzar con el modo del lote).
      if ((mode === 'fixed') !== rowFixed) {
        throw new BadRequestException(
          'No se puede mezclar órdenes con tasa fija (Bs) y en USD en un mismo lote',
        );
      }
      // Exclusividad por porción ('full' choca con todo).
      const taken = portionsInBatch.get(o.id);
      if (
        taken &&
        (taken.has('full') || taken.has(portion) || portion === 'full')
      ) {
        throw new BadRequestException(
          'Una orden (o su porción) ya está en otro lote. Quítala de ese lote primero.',
        );
      }

      const { fixedUsd, indexedUsd } = splitOrderPortionsUsd(o);
      if (portion === 'indexed') {
        out.push({
          orderId: o.id,
          portion,
          useFixedRate: false,
          targetUsd: indexedUsd > 0 ? indexedUsd : Number(o.priceAmount) || 0,
          targetBs: null,
        });
      } else if (portion === 'fixed') {
        out.push({
          orderId: o.id,
          portion,
          useFixedRate: true,
          // targetUsd de porciones fijas = snapshot USD (estado de cuenta).
          targetUsd: fixedUsd,
          targetBs: targetBsForPortion(o, fixedUsd),
        });
      } else {
        out.push({
          orderId: o.id,
          portion: 'full',
          useFixedRate: o.useFixedRate,
          targetUsd: o.useFixedRate
            ? Number(o.priceAmount) || 0
            : targetUsdForOrder(o),
          targetBs: o.useFixedRate ? targetBsForOrder(o) : null,
        });
      }
    }
    if (out.some((r) => r.useFixedRate && r.targetBs == null)) {
      throw new BadRequestException(
        'Una orden con tasa fija no tiene tasa snapshot',
      );
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Cobros.
  // ---------------------------------------------------------------------------
  async registerCollection(
    id: string,
    payments: AccountsReceivablePaymentDto[],
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);

    const usdRateId = this.batchUsdRateId(batch);
    this.computeFigures(batch); // fija batch.mode según las órdenes del lote
    const newTotal =
      batch.mode === 'fixed'
        ? await this.computePaymentsTotalBs(payments, usdRateId)
        : await this.computePaymentsTotalUsd(payments, usdRateId);
    if (newTotal <= 0) {
      throw new BadRequestException(
        'El monto de los cobros debe ser mayor a 0',
      );
    }

    await this.dataSource.transaction(async (mgr) => {
      for (const p of payments) {
        const payload = await this.resolvePaymentForSave(p, usdRateId);
        const saved = await mgr.save(
          mgr.create(AccountsReceivablePayment, payload),
        );
        await mgr.query(
          `INSERT INTO "accounts_receivable_payment_links" ("receivableId", "paymentId")
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, saved.id],
        );
      }
      await this.recomputeStatus(mgr, id);
    });

    return this.findOneBatch(id, user);
  }

  async editPayment(
    id: string,
    paymentId: string,
    dto: AccountsReceivablePaymentDto,
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (!(batch.payments ?? []).some((p) => p.id === paymentId)) {
      throw new NotFoundException('Cobro no encontrado en este lote');
    }
    const usdRateId = this.batchUsdRateId(batch);
    await this.dataSource.transaction(async (mgr) => {
      const payload = await this.resolvePaymentForSave(dto, usdRateId);
      await mgr.update(AccountsReceivablePayment, paymentId, payload);
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async deletePayment(
    id: string,
    paymentId: string,
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (!(batch.payments ?? []).some((p) => p.id === paymentId)) {
      throw new NotFoundException('Cobro no encontrado en este lote');
    }
    await this.dataSource.transaction(async (mgr) => {
      await mgr.query(
        `DELETE FROM "accounts_receivable_payment_links" WHERE "receivableId" = $1 AND "paymentId" = $2`,
        [id, paymentId],
      );
      await mgr.query(
        `DELETE FROM "accounts_receivable_payments" WHERE id = $1`,
        [paymentId],
      );
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async deleteBatch(id: string, user: AuthenticatedUser): Promise<void> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    await this.dataSource.transaction(async (mgr) => {
      const payIds = (batch.payments ?? []).map((p) => p.id);
      if (payIds.length) {
        await mgr.query(
          `DELETE FROM "accounts_receivable_payments" WHERE id = ANY($1)`,
          [payIds],
        );
      }
      await mgr.query(`DELETE FROM "accounts_receivable" WHERE id = $1`, [id]);
    });
  }

  // ---------------------------------------------------------------------------
  // Recompute.
  // ---------------------------------------------------------------------------
  private async recomputeStatus(mgr: EntityManager, id: string): Promise<void> {
    const batch = await this.loadBatch(mgr, id);
    if (!batch) return;
    this.computeFigures(batch);
    let status:
      | 'uncollected'
      | 'partially_collected'
      | 'collected'
      | 'overcollected';
    if (batch.mode === 'fixed') {
      const target = batch.targetBs ?? 0;
      const collected = batch.collectedBs ?? 0;
      if (collected > target + TOLERANCE_BS) status = 'overcollected';
      else if (collected > 0 && Math.abs(target - collected) <= TOLERANCE_BS)
        status = 'collected';
      else if (collected > 0) status = 'partially_collected';
      else status = 'uncollected';
    } else {
      const target = batch.targetUsd ?? 0;
      const collected = batch.collectedUsd ?? 0;
      if (collected > target + TOLERANCE_USD) status = 'overcollected';
      else if (collected > 0 && Math.abs(target - collected) <= TOLERANCE_USD)
        status = 'collected';
      else if (collected > 0) status = 'partially_collected';
      else status = 'uncollected';
    }
    const collectedAt =
      status === 'collected' || status === 'overcollected'
        ? (batch.collectedAt ?? new Date())
        : null;
    await mgr.update(AccountsReceivable, id, { status, collectedAt });
  }

  // ---------------------------------------------------------------------------
  // Conversión de cobros (sin cambios respecto al modelo anterior).
  // ---------------------------------------------------------------------------
  /**
   * Tasa USD/Bs de referencia para convertir los cobros del lote:
   *  - Modo tasa fija (seguro "No indexado", isIndexed=true): la tasa fija snapshot de la orden
   *    (primera del lote que tenga una) — el cobro se convierte a la tasa
   *    fijada en la orden, no a la del día.
   *  - Modo USD: la tasa de facturación de la primera orden; sin ella,
   *    `resolveUsdRate` cae a la última tasa USD.
   */
  private batchUsdRateId(batch: AccountsReceivable): string | null {
    const fixed = (batch.orders ?? []).some((o) => o.useFixedRate);
    if (fixed) {
      const withFixed = (batch.orders ?? []).find(
        (o) => o.order?.fixedExchangeRateId,
      );
      if (withFixed?.order?.fixedExchangeRateId) {
        return withFixed.order.fixedExchangeRateId;
      }
    }
    return batch.orders?.[0]?.order?.billingExchangeRateId ?? null;
  }

  private async resolvePaymentForSave(
    p: AccountsReceivablePaymentDto,
    usdExchangeRateId?: string | null,
  ): Promise<Partial<AccountsReceivablePayment>> {
    const out: Partial<AccountsReceivablePayment> = {
      type: p.type,
      paymentDate: p.paymentDate,
      referenceNumber: p.referenceNumber ?? null,
      bankCode: null,
      accountNumber: null,
      exchangeRateId: null,
      paymentAccountId: null,
      amountCurrency: p.amountCurrency,
      amountValue: p.amountValue.toFixed(2),
      amountInUsd: '0',
    };
    // Tasa USD/Bs de referencia para convertir. La tasa elegida en el propio
    // cobro (Bs) manda sobre la del lote: el cobro pudo hacerse otro día, a
    // otra tasa. Mismo criterio que Órdenes (Paso 1) y Cuentas por pagar.
    let usdCtxId = usdExchangeRateId ?? null;

    const needsPaymentAccount =
      p.type === 'mobile_payment' ||
      p.type === 'bank_transfer' ||
      p.type === 'bank_transfer_usd' ||
      p.type === 'card' ||
      p.type === 'other';

    if (needsPaymentAccount) {
      if (!p.paymentAccountId)
        throw new BadRequestException(
          `paymentAccountId requerido para cobros de tipo ${p.type}`,
        );
      const account = await this.paymentAccounts.assertUsableForPaymentType(
        p.paymentAccountId,
        p.type as
          | 'mobile_payment'
          | 'bank_transfer'
          | 'bank_transfer_usd'
          | 'card'
          | 'other',
      );
      out.paymentAccountId = account.id;
      out.bankCode = account.bankCode ?? null;
      out.accountNumber = account.accountNumber ?? null;
    } else if (p.paymentAccountId) {
      throw new BadRequestException(
        `Cobros de tipo ${p.type} no pueden referenciar una cuenta bancaria`,
      );
    }

    if (
      p.type === 'mobile_payment' ||
      p.type === 'bank_transfer' ||
      p.type === 'card'
    ) {
      if (!p.referenceNumber)
        throw new BadRequestException('referenceNumber requerido');
      if (!p.exchangeRateId)
        throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException(
          'Pago móvil/transferencia/punto debe ser en BS',
        );
      const rate = await this.ratesRepo.findOne({
        where: { id: p.exchangeRateId },
      });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('Cobro en BS requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
      usdCtxId = p.exchangeRateId;
    } else if (p.type === 'cash_bs') {
      if (!p.exchangeRateId)
        throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException('cash_bs debe ser en BS');
      const rate = await this.ratesRepo.findOne({
        where: { id: p.exchangeRateId },
      });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('cash_bs requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
      usdCtxId = p.exchangeRateId;
    } else if (p.type === 'bank_transfer_usd') {
      if (!p.referenceNumber)
        throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException(
          'Transferencia en dólares debe ser en USD',
        );
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_usd') {
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('cash_usd debe ser en USD');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_eur') {
      if (p.amountCurrency !== 'EUR')
        throw new BadRequestException('cash_eur debe ser en EUR');
      if (!p.exchangeRateId)
        throw new BadRequestException('exchangeRateId requerido (EUR)');
      const rate = await this.ratesRepo.findOne({
        where: { id: p.exchangeRateId },
      });
      if (!rate || rate.currency !== 'EUR')
        throw new BadRequestException(
          'cash_eur requiere una tasa de cambio en EUR',
        );
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'other') {
      if (!p.referenceNumber)
        throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency === 'BS' || p.amountCurrency === 'EUR') {
        if (!p.exchangeRateId)
          throw new BadRequestException(
            `exchangeRateId requerido para cobro other en ${p.amountCurrency}`,
          );
        const rate = await this.ratesRepo.findOne({
          where: { id: p.exchangeRateId },
        });
        if (!rate)
          throw new BadRequestException('Tasa de cambio no encontrada');
        if (p.amountCurrency === 'BS' && rate.currency !== 'USD')
          throw new BadRequestException('other en BS requiere tasa USD/Bs');
        if (p.amountCurrency === 'EUR' && rate.currency !== 'EUR')
          throw new BadRequestException('other en EUR requiere tasa EUR/Bs');
        out.exchangeRateId = p.exchangeRateId;
        if (p.amountCurrency === 'BS') usdCtxId = p.exchangeRateId;
      }
    }

    const conversionInput = {
      amountValue: p.amountValue,
      amountCurrency: p.amountCurrency,
      exchangeRateId: p.exchangeRateId ?? null,
    };
    const usdAmount = await computeAmountInUsd(
      conversionInput,
      this.ratesRepo,
      {
        usdExchangeRateId: usdCtxId,
      },
    );
    out.amountInUsd = usdAmount.toFixed(2);
    const bsAmount = await computeAmountInBs(conversionInput, this.ratesRepo, {
      usdExchangeRateId: usdCtxId,
    });
    out.amountInBs = bsAmount.toFixed(2);
    return out;
  }

  /**
   * Tasa USD/Bs con la que se convierte un cobro: la del propio cobro cuando
   * viene en Bs (manda sobre la del lote), sino la de referencia del lote.
   */
  private usdCtxIdForPayment(
    p: AccountsReceivablePaymentDto,
    usdExchangeRateId: string | null,
  ): string | null {
    return p.amountCurrency === 'BS'
      ? (p.exchangeRateId ?? usdExchangeRateId)
      : usdExchangeRateId;
  }

  private async computePaymentsTotalBs(
    payments: AccountsReceivablePaymentDto[],
    usdExchangeRateId: string | null,
  ): Promise<number> {
    let total = 0;
    for (const p of payments) {
      total += await computeAmountInBs(
        {
          amountValue: p.amountValue,
          amountCurrency: p.amountCurrency,
          exchangeRateId: p.exchangeRateId ?? null,
        },
        this.ratesRepo,
        { usdExchangeRateId: this.usdCtxIdForPayment(p, usdExchangeRateId) },
      );
    }
    return round2(total);
  }

  private async computePaymentsTotalUsd(
    payments: AccountsReceivablePaymentDto[],
    usdExchangeRateId: string | null,
  ): Promise<number> {
    let total = 0;
    for (const p of payments) {
      total += await computeAmountInUsd(
        {
          amountValue: p.amountValue,
          amountCurrency: p.amountCurrency,
          exchangeRateId: p.exchangeRateId ?? null,
        },
        this.ratesRepo,
        { usdExchangeRateId: this.usdCtxIdForPayment(p, usdExchangeRateId) },
      );
    }
    return round2(total);
  }
}
