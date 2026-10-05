import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AccountsPayable } from './entities/accounts-payable.entity';
import { AccountsPayablePayment } from './entities/accounts-payable-payment.entity';
import { AccountsPayableSettlement } from './entities/accounts-payable-settlement.entity';
import { AccountsPayableOrder } from './entities/accounts-payable-order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { TaxUnit } from '../tax-units/entities/tax-unit.entity';
import { TaxUnitsService } from '../tax-units/tax-units.service';
import {
  AccountsPayablePaymentDto,
  AccountsPayableSettlementDto,
  CreateAccountsPayableBatchDto,
  QueryAccountsPayableDto,
  QueryPendingPayableDto,
} from './dto/register-payment.dto';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  computeAmountInBs,
  computeAmountInUsd,
  resolveUsdRate,
} from '../shared/utils/payment-conversion';
import {
  calcSliceRetention,
  SeniatPersonType,
  SliceRetentionResult,
} from '../shared/utils/seniat-retention';

const TOLERANCE_BS = 0.01;
const TOLERANCE_USD = 0.01;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Orden interna facturada disponible para armar un lote (Pendiente). */
export interface PendingPayable {
  internalOrderId: string;
  internalNumber: string;
  orderId: string;
  orderNumber: string;
  providerType: 'doctor' | 'care_center';
  doctorId: string | null;
  careCenterId: string | null;
  providerName: string;
  grossUsd: number;
  billingExchangeRateId: string | null;
  branchId: string;
  branchName: string | null;
  createdAt: string;
}

/** Agregados del pivot de un lote, resueltos en SQL (1 query por página). */
interface PayableOrderTotals {
  orderCount: number;
  /** Σ `grossUsd` del pivot. */
  grossUsd: number;
  /** Σ `grossUsd` × tasa de facturación de cada orden (fallback sin tasa de lote). */
  grossBsBilling: number;
}

/** Agregados de los abonos de un lote, resueltos en SQL (listado). */
interface PayableSettlementTotals {
  count: number;
  /** Σ `coveredUsd`: USD del bruto ya cubiertos. */
  coveredUsd: number;
  /** Σ `grossBs`: bruto abonado, a la tasa de cada abono. */
  grossBs: number;
  /** Σ `retentionBs`: retención ya practicada. */
  retentionBs: number;
  /** Σ `netBs`: entregado al proveedor. */
  netBs: number;
}

/**
 * Cálculo de UN abono, todo a SU tasa: bruto de la porción cubierta, retención
 * (prorrateada o manual) y neto a entregar al proveedor. Es lo que se
 * snapshotea en `accounts_payable_settlements`.
 */
interface SettlementCalc {
  coveredUsd: number;
  exchangeRateId: string;
  rateBs: number;
  grossBs: number;
  personType: SeniatPersonType;
  taxUnitId: string | null;
  taxUnitAmountBs: number;
  taxRate: number;
  subtrahendBs: number;
  retentionBs: number;
  netBs: number;
  /** ¿`retentionBs` lo fijó el usuario (no el cálculo prorrateado)? */
  isCustomRetention: boolean;
}

@Injectable()
export class AccountsPayableService {
  constructor(
    @InjectRepository(AccountsPayable)
    private readonly repo: Repository<AccountsPayable>,
    @InjectRepository(AccountsPayablePayment)
    private readonly paymentsRepo: Repository<AccountsPayablePayment>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(ExchangeRate)
    private readonly ratesRepo: Repository<ExchangeRate>,
    @InjectRepository(Doctor) private readonly doctorsRepo: Repository<Doctor>,
    private readonly dataSource: DataSource,
    private readonly taxUnits: TaxUnitsService,
  ) {
    void this.paymentsRepo;
    void this.doctorsRepo;
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
  // Pendientes: órdenes internas facturadas, sin lote.
  // ---------------------------------------------------------------------------
  async listPending(
    query: QueryPendingPayableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<PendingPayable>> {
    const {
      page = 1,
      limit = 10,
      search,
      doctorId,
      careCenterId,
      branchId,
    } = query;
    const params: unknown[] = [];
    const where: string[] = [
      `o.status = 'finalized'`,
      `o."deletedAt" IS NULL`,
      `iio."providerAmountUsd" IS NOT NULL`,
      `NOT EXISTS (SELECT 1 FROM "accounts_payable_orders" apo WHERE apo."internalOrderId" = iio.id)`,
    ];

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) return emptyPage(page, limit);
      params.push(allowed);
      where.push(`o."branchId" = ANY($${params.length})`);
    }
    if (doctorId) {
      params.push(doctorId);
      where.push(`iio."doctorId" = $${params.length}`);
    }
    if (careCenterId) {
      params.push(careCenterId);
      where.push(`iio."careCenterId" = $${params.length}`);
    }
    if (branchId) {
      params.push(branchId);
      where.push(`o."branchId" = $${params.length}`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where.push(
        `(LOWER(iio."internalNumber") LIKE $${params.length} OR LOWER(o."orderNumber") LIKE $${params.length})`,
      );
    }

    const whereSql = where.join(' AND ');
    const countRows = await this.dataSource.query<{ c: string }[]>(
      `SELECT count(*)::int AS c
       FROM "order_internal_orders" iio
       JOIN "orders" o ON o.id = iio."orderId"
       WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.c ?? 0);
    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];
    const rows = await this.dataSource.query<PendingPayable[]>(
      `SELECT iio.id AS "internalOrderId", iio."internalNumber", iio."orderId",
              o."orderNumber", iio."providerType", iio."doctorId", iio."careCenterId",
              iio."providerAmountUsd"::float8 AS "grossUsd",
              o."billingExchangeRateId", o."branchId", b."name" AS "branchName",
              COALESCE(d."firstName" || ' ' || d."lastName", cc."businessName") AS "providerName",
              iio."createdAt"
       FROM "order_internal_orders" iio
       JOIN "orders" o ON o.id = iio."orderId"
       LEFT JOIN "branches" b ON b.id = o."branchId"
       LEFT JOIN "doctors" d ON d.id = iio."doctorId"
       LEFT JOIN "care_centers" cc ON cc.id = iio."careCenterId"
       WHERE ${whereSql}
       ORDER BY iio."internalNumber"::int DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );
    return {
      data: rows,
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
    query: QueryAccountsPayableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<AccountsPayable>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      doctorId,
      careCenterId,
      branchId,
      sortBy = 'createdAt',
      sortDir = 'DESC',
    } = query;

    // Paginado en dos pasos. Paso 1: filtrar/ordenar sobre `accounts_payable`
    // SOLA — sin joins a colecciones — para que el LIMIT/OFFSET y el COUNT
    // trabajen sobre índices y no sobre el producto cartesiano lote×órdenes×
    // pagos que generaba `leftJoinAndSelect` + `skip/take`.
    const qb = this.repo.createQueryBuilder('ap');

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else
        qb.andWhere(
          `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo2
                   JOIN "order_internal_orders" iio2 ON iio2.id = apo2."internalOrderId"
                   JOIN "orders" o2 ON o2.id = iio2."orderId"
                   WHERE apo2."payableId" = ap.id AND o2."branchId" IN (:...allowed))`,
          { allowed },
        );
    }
    if (status) qb.andWhere('ap.status = :status', { status });
    if (doctorId) qb.andWhere('ap.doctorId = :doctorId', { doctorId });
    if (careCenterId)
      qb.andWhere('ap.careCenterId = :careCenterId', { careCenterId });
    if (branchId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo3
                 JOIN "order_internal_orders" iio3 ON iio3.id = apo3."internalOrderId"
                 JOIN "orders" o3 ON o3.id = iio3."orderId"
                 WHERE apo3."payableId" = ap.id AND o3."branchId" = :branchId)`,
        { branchId },
      );
    }
    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(ap."payableNumber") LIKE :s
          OR EXISTS (SELECT 1 FROM "accounts_payable_orders" apo4
                     JOIN "order_internal_orders" iio4 ON iio4.id = apo4."internalOrderId"
                     WHERE apo4."payableId" = ap.id AND LOWER(iio4."internalNumber") LIKE :s))`,
        { s },
      );
    }

    const total = await qb.getCount();
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const ids = (
      await qb
        .select('ap.id', 'id')
        // `id` como desempate (en la misma dirección que el sort, para que el
        // índice compuesto sirva en ASC y en DESC): el orden es estable entre
        // páginas aunque dos lotes compartan `createdAt`.
        .orderBy(`ap.${sortBy}`, sortDir)
        .addOrderBy('ap.id', sortDir)
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<{ id: string }>()
    ).map((r) => r.id);
    if (ids.length === 0)
      return { data: [], metadata: { total, page, lastPage } };

    // Paso 2: hidratar sólo la página. El pivot NO se trae: sus agregados
    // (nº de órdenes y brutos) salen de una única query agrupada.
    const [rows, totals, settlements, taxUnitBs] = await Promise.all([
      this.repo.find({
        where: { id: In(ids) },
        relations: {
          doctor: true,
          careCenter: true,
          taxUnit: true,
          exchangeRate: true,
        },
      }),
      this.orderTotals(ids),
      this.settlementsByPayable(ids),
      this.currentTaxUnitBs(),
    ]);
    const byId = new Map(rows.map((b) => [b.id, b]));
    const data = ids
      .map((id) => byId.get(id))
      .filter((b): b is AccountsPayable => !!b);
    for (const b of data) {
      b.settlements = settlements.get(b.id) ?? [];
      this.computeFigures(b, taxUnitBs, totals.get(b.id));
    }
    return { data, metadata: { total, page, lastPage } };
  }

  /**
   * Agregados del pivot de varios lotes en una sola query: nº de órdenes,
   * bruto USD y bruto Bs a la tasa de facturación de cada orden (el fallback
   * de {@link computeFigures} cuando el lote no tiene tasa de pago propia).
   */
  private async orderTotals(
    ids: string[],
  ): Promise<Map<string, PayableOrderTotals>> {
    const rows = await this.dataSource.query<
      Array<{
        payableId: string;
        orderCount: string;
        grossUsd: string;
        grossBsBilling: string;
      }>
    >(
      `SELECT apo."payableId",
              COUNT(*) AS "orderCount",
              COALESCE(SUM(apo."grossUsd"), 0) AS "grossUsd",
              COALESCE(SUM(apo."grossUsd" * COALESCE(er."amountBs", 0)), 0) AS "grossBsBilling"
       FROM "accounts_payable_orders" apo
       JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
       JOIN "orders" o ON o.id = iio."orderId"
       LEFT JOIN "exchange_rates" er ON er.id = o."billingExchangeRateId"
       WHERE apo."payableId" = ANY($1)
       GROUP BY apo."payableId"`,
      [ids],
    );
    return new Map(
      rows.map((r) => [
        r.payableId,
        {
          orderCount: Number(r.orderCount) || 0,
          grossUsd: Number(r.grossUsd) || 0,
          grossBsBilling: Number(r.grossBsBilling) || 0,
        },
      ]),
    );
  }

  /**
   * Abonos de varios lotes en una query (listado). Sin sus filas de pago: el
   * listado sólo necesita los totales y la fecha/tasa de cada abono.
   */
  private async settlementsByPayable(
    ids: string[],
  ): Promise<Map<string, AccountsPayableSettlement[]>> {
    const rows = await this.dataSource.manager.find(AccountsPayableSettlement, {
      where: { payableId: In(ids) },
      order: { settlementDate: 'ASC', createdAt: 'ASC' },
    });
    const out = new Map<string, AccountsPayableSettlement[]>();
    for (const r of rows) {
      const arr = out.get(r.payableId) ?? [];
      arr.push(r);
      out.set(r.payableId, arr);
    }
    return out;
  }

  async findOneBatch(
    id: string,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    // El lote y la UT vigente no dependen entre sí: una sola ida y vuelta.
    const [batch, taxUnitBs] = await Promise.all([
      this.loadBatch(this.dataSource.manager, id),
      this.currentTaxUnitBs(),
    ]);
    if (!batch)
      throw new NotFoundException('Lote de cuentas por pagar no encontrado');
    await this.assertVisibility(batch, user);
    this.computeFigures(batch, taxUnitBs);
    return batch;
  }

  /**
   * Lote con sus órdenes y sus abonos. Las dos colecciones se traen en queries
   * paralelas a propósito: en un solo \`findOne\` TypeORM las une por LEFT JOIN y
   * devuelve el producto cartesiano órdenes × abonos × filas de pago.
   */
  private async loadBatch(
    mgr: EntityManager,
    id: string,
  ): Promise<AccountsPayable | null> {
    const [batch, settlements] = await Promise.all([
      mgr.findOne(AccountsPayable, {
        where: { id },
        relations: {
          doctor: true,
          careCenter: true,
          taxUnit: true,
          exchangeRate: true,
          orders: {
            internalOrder: {
              order: { branch: true, billingExchangeRate: true },
            },
          },
        },
      }),
      mgr.find(AccountsPayableSettlement, {
        where: { payableId: id },
        relations: {
          exchangeRate: true,
          taxUnit: true,
          payments: { exchangeRate: true },
        },
        order: { settlementDate: 'ASC', createdAt: 'ASC' },
      }),
    ]);
    if (!batch) return null;
    batch.settlements = settlements;
    return batch;
  }

  private async assertVisibility(
    batch: AccountsPayable,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = new Set(await this.resolveUserBranchIds(user));
    const branchIds = (batch.orders ?? [])
      .map((o) => o.internalOrder?.order?.branchId)
      .filter(Boolean) as string[];
    if (branchIds.length === 0 || branchIds.some((b) => !allowed.has(b))) {
      throw new ForbiddenException('No tenés acceso a este lote');
    }
  }

  private async currentTaxUnitBs(): Promise<number> {
    const ut = await this.taxUnits.getCurrentOrThrow();
    return Number(ut.amountBs);
  }

  /** UT elegida por el usuario (validada) o la vigente si no se envió. */
  private async resolveTaxUnit(taxUnitId?: string | null): Promise<TaxUnit> {
    if (!taxUnitId) return this.taxUnits.getCurrentOrThrow();
    const ut = await this.taxUnits.findOne(taxUnitId);
    if (!ut.isActive) {
      throw new BadRequestException(
        'La Unidad Tributaria seleccionada está deshabilitada',
      );
    }
    return ut;
  }

  /**
   * Tasa de pago USD/Bs elegida por el usuario (validada) o la USD vigente
   * (activa más reciente) si no se envió.
   */
  private async resolvePaymentRate(
    exchangeRateId?: string | null,
  ): Promise<ExchangeRate> {
    if (exchangeRateId) {
      const rate = await this.ratesRepo.findOne({
        where: { id: exchangeRateId },
      });
      if (!rate) throw new BadRequestException('Tasa de pago no encontrada');
      if (rate.currency !== 'USD') {
        throw new BadRequestException('La tasa de pago debe ser USD/Bs');
      }
      const bs = Number(rate.amountBs);
      if (!Number.isFinite(bs) || bs <= 0) {
        throw new BadRequestException('Tasa de pago inválida (amountBs ≤ 0)');
      }
      return rate;
    }
    const current = await this.ratesRepo.findOne({
      where: { currency: 'USD', isActive: true },
      order: { effectiveDate: 'DESC', createdAt: 'DESC' },
    });
    if (!current) {
      throw new BadRequestException(
        'No hay tasa de cambio USD activa. Cargá una en /exchange-rates antes de continuar.',
      );
    }
    return current;
  }

  private personTypeOf(batch: AccountsPayable): SeniatPersonType {
    if (batch.recipientType === 'care_center') return 'legal_entity';
    return batch.doctor?.isLegalEntity ? 'legal_entity' : 'natural';
  }

  /** ¿El lote descuenta retención? Lotes previos a la columna (undefined) ⇒ sí. */
  private appliesRetention(batch: AccountsPayable): boolean {
    return batch.applyRetention !== false;
  }

  /**
   * Tasa de pago USD/Bs POR DEFECTO del lote (si la tiene y es válida): la que
   * se propone a cada abono nuevo y con la que se proyecta en Bs el saldo
   * pendiente. NULL ⇒ cae a la tasa de facturación de las órdenes.
   */
  private batchRateBs(batch: AccountsPayable): number | null {
    const bs = Number(batch.exchangeRate?.amountBs);
    return Number.isFinite(bs) && bs > 0 ? bs : null;
  }

  /** Bruto USD del lote (Σ del pivot de órdenes). */
  private grossUsdOf(batch: AccountsPayable): number {
    return round2(
      (batch.orders ?? []).reduce((s, o) => s + (Number(o.grossUsd) || 0), 0),
    );
  }

  /** Agregados de los abonos ya hidratados (detalle). */
  private settlementFigures(
    settlements: AccountsPayableSettlement[],
  ): PayableSettlementTotals {
    let coveredUsd = 0;
    let grossBs = 0;
    let retentionBs = 0;
    let netBs = 0;
    for (const s of settlements) {
      coveredUsd += Number(s.coveredUsd) || 0;
      grossBs += Number(s.grossBs) || 0;
      retentionBs += Number(s.retentionBs) || 0;
      netBs += Number(s.netBs) || 0;
    }
    return {
      count: settlements.length,
      coveredUsd: round2(coveredUsd),
      grossBs: round2(grossBs),
      retentionBs: round2(retentionBs),
      netBs: round2(netBs),
    };
  }

  /**
   * Proyección en Bs del saldo aún no abonado, a la tasa por defecto del lote:
   * lo que costaría terminar de pagarlo hoy. No se persiste — el abono que lo
   * liquide fijará su propia tasa y su propia retención.
   */
  private projectPending(
    batch: AccountsPayable,
    pendingUsd: number,
    grossUsd: number,
    rateBs: number,
    taxUnitBs: number,
  ): { grossBs: number; retentionBs: number } {
    if (pendingUsd <= 0 || !(rateBs > 0)) return { grossBs: 0, retentionBs: 0 };
    const grossBs = round2(pendingUsd * rateBs);
    if (!this.appliesRetention(batch)) return { grossBs, retentionBs: 0 };
    const r = calcSliceRetention({
      sliceUsd: pendingUsd,
      totalUsd: grossUsd,
      rateBs,
      personType: this.personTypeOf(batch),
      taxUnitBs,
    });
    return { grossBs, retentionBs: r.taxAmountBs };
  }

  /**
   * Calcula y adjunta los campos transient del lote. El saldo se lleva en USD
   * (`pendingUsd`); los importes en Bs mezclan lo ya abonado — a la tasa de
   * cada abono — con la proyección del saldo a la tasa por defecto.
   */
  private computeFigures(
    batch: AccountsPayable,
    fallbackTaxUnitBs: number,
    totals?: PayableOrderTotals,
  ): void {
    let grossUsd = 0;
    let billedGrossBs = 0;
    if (totals) {
      // Listado: el pivot no viene hidratado, los brutos ya vienen sumados.
      grossUsd = totals.grossUsd;
      billedGrossBs = totals.grossBsBilling;
      batch.orderCount = totals.orderCount;
    } else {
      for (const apo of batch.orders ?? []) {
        const g = Number(apo.grossUsd) || 0;
        grossUsd += g;
        billedGrossBs +=
          g *
          Number(apo.internalOrder?.order?.billingExchangeRate?.amountBs ?? 0);
      }
      batch.orderCount = (batch.orders ?? []).length;
    }
    grossUsd = round2(grossUsd);

    const s = this.settlementFigures(batch.settlements ?? []);
    const coveredUsd = round2(Math.min(grossUsd, s.coveredUsd));
    const pendingUsd = Math.max(0, round2(grossUsd - coveredUsd));
    const taxUnitBs = batch.taxUnit
      ? Number(batch.taxUnit.amountBs)
      : fallbackTaxUnitBs;
    const projRate =
      this.batchRateBs(batch) ?? (grossUsd > 0 ? billedGrossBs / grossUsd : 0);
    const proj = this.projectPending(
      batch,
      pendingUsd,
      grossUsd,
      projRate,
      taxUnitBs,
    );

    batch.grossUsd = grossUsd;
    batch.settlementCount = s.count;
    batch.coveredUsd = coveredUsd;
    batch.pendingUsd = pendingUsd;
    batch.settledGrossBs = s.grossBs;
    batch.settledRetentionBs = s.retentionBs;
    batch.grossBs = round2(s.grossBs + proj.grossBs);
    batch.retentionBs = round2(s.retentionBs + proj.retentionBs);
    batch.netBs = round2(batch.grossBs - batch.retentionBs);
    batch.paidBs = s.netBs;
    batch.pendingBs = Math.max(0, round2(proj.grossBs - proj.retentionBs));
  }

  /**
   * Resuelve el cálculo de un abono sobre el lote: valida que la porción en USD
   * quepa en el saldo, fija la tasa y calcula la retención (prorrateada o
   * manual) y el neto. `excludeSettlementId` deja fuera del saldo al abono que
   * se está editando.
   */
  private async buildSettlementCalc(
    batch: AccountsPayable,
    dto: AccountsPayableSettlementDto,
    excludeSettlementId?: string,
  ): Promise<SettlementCalc> {
    const grossUsd = this.grossUsdOf(batch);
    if (grossUsd <= 0) throw new BadRequestException('El lote no tiene órdenes');
    const covered = round2(
      (batch.settlements ?? [])
        .filter((s) => s.id !== excludeSettlementId)
        .reduce((acc, s) => acc + (Number(s.coveredUsd) || 0), 0),
    );
    const coveredUsd = round2(dto.coveredUsd);
    if (coveredUsd <= 0) {
      throw new BadRequestException('Los USD a cubrir deben ser mayores a 0');
    }
    const remainingUsd = round2(grossUsd - covered);
    if (coveredUsd - remainingUsd > TOLERANCE_USD) {
      throw new BadRequestException(
        `El abono cubre ${coveredUsd.toFixed(2)} USD pero al lote sólo le faltan ${remainingUsd.toFixed(2)} USD (bruto ${grossUsd.toFixed(2)} USD, ya cubiertos ${covered.toFixed(2)} USD).`,
      );
    }

    const rate = await this.resolvePaymentRate(dto.exchangeRateId);
    const rateBs = Number(rate.amountBs);
    const grossBs = round2(coveredUsd * rateBs);
    const personType = this.personTypeOf(batch);
    const applies = this.appliesRetention(batch);

    let taxUnit: TaxUnit | null = null;
    let auto: SliceRetentionResult | null = null;
    if (applies) {
      taxUnit = await this.resolveTaxUnit(
        dto.taxUnitId ?? batch.taxUnitId ?? undefined,
      );
      auto = calcSliceRetention({
        sliceUsd: coveredUsd,
        totalUsd: grossUsd,
        rateBs,
        personType,
        taxUnitBs: Number(taxUnit.amountBs),
      });
    }
    const custom =
      applies &&
      dto.customRetentionBs !== undefined &&
      dto.customRetentionBs !== null
        ? round2(dto.customRetentionBs)
        : null;
    if (custom !== null && custom - grossBs > TOLERANCE_BS) {
      throw new BadRequestException(
        `La retención del abono (${custom.toFixed(2)} Bs) supera su bruto (${grossBs.toFixed(2)} Bs).`,
      );
    }
    const retentionBs = applies ? (custom ?? auto?.taxAmountBs ?? 0) : 0;
    return {
      coveredUsd,
      exchangeRateId: rate.id,
      rateBs,
      grossBs,
      personType,
      taxUnitId: taxUnit?.id ?? null,
      taxUnitAmountBs: taxUnit ? Number(taxUnit.amountBs) : 0,
      taxRate: auto?.taxRate ?? 0,
      subtrahendBs: auto?.subtrahendBs ?? 0,
      retentionBs,
      netBs: round2(grossBs - retentionBs),
      isCustomRetention: custom !== null,
    };
  }

  /** Columnas persistibles de un {@link SettlementCalc}. */
  private calcToColumns(
    calc: SettlementCalc,
  ): Partial<AccountsPayableSettlement> {
    return {
      coveredUsd: calc.coveredUsd.toFixed(2),
      exchangeRateId: calc.exchangeRateId,
      rateBs: calc.rateBs.toFixed(2),
      grossBs: calc.grossBs.toFixed(2),
      personType: calc.personType,
      taxUnitId: calc.taxUnitId,
      taxUnitAmountBs: calc.taxUnitAmountBs.toFixed(2),
      taxRate: calc.taxRate.toFixed(4),
      subtrahendBs: calc.subtrahendBs.toFixed(2),
      retentionBs: calc.retentionBs.toFixed(2),
      isCustomRetention: calc.isCustomRetention,
      netBs: calc.netBs.toFixed(2),
    };
  }

  // ---------------------------------------------------------------------------
  // Crear / mutar lote.
  // ---------------------------------------------------------------------------
  async createBatch(
    dto: CreateAccountsPayableBatchDto,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const providerId =
      dto.recipientType === 'doctor' ? dto.doctorId : dto.careCenterId;
    if (!providerId) {
      throw new BadRequestException(
        `Falta ${dto.recipientType === 'doctor' ? 'doctorId' : 'careCenterId'}`,
      );
    }

    const rows = await this.validatePendingRows(dto.internalOrderIds, user);
    for (const r of rows) {
      const rPid = r.providerType === 'doctor' ? r.doctorId : r.careCenterId;
      if (r.providerType !== dto.recipientType || rPid !== providerId) {
        throw new BadRequestException(
          'Todas las órdenes del lote deben ser del mismo proveedor seleccionado',
        );
      }
    }
    const [taxUnit, paymentRate] = await Promise.all([
      this.resolveTaxUnit(dto.taxUnitId),
      this.resolvePaymentRate(dto.exchangeRateId),
    ]);
    const applyRetention = dto.applyRetention ?? true;

    const id = await this.dataSource.transaction(async (mgr) => {
      const seq = await mgr.query<{ nextval: string }[]>(
        `SELECT nextval('accounts_payable_seq') AS nextval`,
      );
      const payableNumber = String(seq[0].nextval);
      const inserted = await mgr.query<{ id: string }[]>(
        `INSERT INTO "accounts_payable" ("payableNumber", "recipientType", "doctorId", "careCenterId", "taxUnitId", "applyRetention", "exchangeRateId", "status")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid') RETURNING id`,
        [
          payableNumber,
          dto.recipientType,
          dto.recipientType === 'doctor' ? providerId : null,
          dto.recipientType === 'care_center' ? providerId : null,
          taxUnit.id,
          applyRetention,
          paymentRate.id,
        ],
      );
      const batchId = inserted[0].id;
      for (const r of rows) {
        await mgr.query(
          `INSERT INTO "accounts_payable_orders" ("payableId", "internalOrderId", "grossUsd")
           VALUES ($1, $2, $3)`,
          [batchId, r.internalOrderId, Number(r.grossUsd).toFixed(2)],
        );
      }
      return batchId;
    });

    return this.findOneBatch(id, user);
  }

  async addOrders(
    id: string,
    internalOrderIds: string[],
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    // Agregar órdenes a un lote pagado sube su bruto y lo reabre como parcial:
    // los abonos ya hechos (y sus retenciones) no se tocan.
    const providerId =
      batch.recipientType === 'doctor' ? batch.doctorId : batch.careCenterId;
    const rows = await this.validatePendingRows(internalOrderIds, user);
    for (const r of rows) {
      const rPid = r.providerType === 'doctor' ? r.doctorId : r.careCenterId;
      if (r.providerType !== batch.recipientType || rPid !== providerId) {
        throw new BadRequestException(
          'La orden no pertenece al proveedor del lote',
        );
      }
    }
    await this.dataSource.transaction(async (mgr) => {
      for (const r of rows) {
        await mgr.query(
          `INSERT INTO "accounts_payable_orders" ("payableId", "internalOrderId", "grossUsd")
           VALUES ($1, $2, $3)`,
          [id, r.internalOrderId, Number(r.grossUsd).toFixed(2)],
        );
      }
      await this.recomputeBatchStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async removeOrders(
    id: string,
    internalOrderIds: string[],
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    const remaining = (batch.orders ?? []).filter(
      (o) => !internalOrderIds.includes(o.internalOrderId),
    );
    if (remaining.length === 0) {
      throw new BadRequestException(
        'El lote quedaría vacío. Eliminá el lote en su lugar.',
      );
    }
    const remainingUsd = round2(
      remaining.reduce((s, o) => s + (Number(o.grossUsd) || 0), 0),
    );
    const coveredUsd = this.settlementFigures(batch.settlements ?? []).coveredUsd;
    if (coveredUsd - remainingUsd > TOLERANCE_USD) {
      throw new BadRequestException(
        `El lote quedaría en ${remainingUsd.toFixed(2)} USD y ya tiene ${coveredUsd.toFixed(2)} USD abonados. Elimina un abono primero.`,
      );
    }
    await this.dataSource.transaction(async (mgr) => {
      await mgr.query(
        `DELETE FROM "accounts_payable_orders"
         WHERE "payableId" = $1 AND "internalOrderId" = ANY($2)`,
        [id, internalOrderIds],
      );
      await this.recomputeBatchStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  /**
   * Cambia la UT del lote: la que se propone a los PRÓXIMOS abonos y con la que
   * se proyecta la retención del saldo. Los abonos ya registrados conservan la
   * UT con la que se practicó su retención.
   */
  async setTaxUnit(
    id: string,
    taxUnitId: string,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    const taxUnit = await this.resolveTaxUnit(taxUnitId);
    await this.repo.update(id, { taxUnitId: taxUnit.id });
    return this.findOneBatch(id, user);
  }

  /**
   * Activa/desactiva la retención de ISLR del lote. Sólo mientras no tenga
   * abonos: cada abono snapshotea su retención y su obligación SENIAT, así que
   * cambiar el régimen a mitad de camino dejaría el lote mezclado.
   */
  async setRetention(
    id: string,
    applyRetention: boolean,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (this.appliesRetention(batch) === applyRetention)
      return this.findOneBatch(id, user);
    if ((batch.settlements ?? []).length > 0) {
      throw new BadRequestException(
        'El lote ya tiene abonos registrados. Para cambiar la retención, elimina sus abonos primero.',
      );
    }
    await this.repo.update(id, { applyRetention });
    return this.findOneBatch(id, user);
  }

  /**
   * Cambia la tasa de pago USD/Bs POR DEFECTO del lote: la que se propone al
   * próximo abono y con la que se proyecta el saldo en Bs. Los abonos ya
   * registrados conservan la suya — por eso puede cambiarse en cualquier
   * momento sin alterar lo ya pagado.
   */
  async setExchangeRate(
    id: string,
    exchangeRateId: string,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    const rate = await this.resolvePaymentRate(exchangeRateId);
    if (batch.exchangeRateId === rate.id) return this.findOneBatch(id, user);
    await this.repo.update(id, { exchangeRateId: rate.id });
    return this.findOneBatch(id, user);
  }

  /** Valida que las órdenes internas existan, estén facturadas, visibles y sin lote. */
  private async validatePendingRows(
    internalOrderIds: string[],
    user: AuthenticatedUser,
  ): Promise<
    Array<{
      internalOrderId: string;
      orderId: string;
      providerType: 'doctor' | 'care_center';
      doctorId: string | null;
      careCenterId: string | null;
      grossUsd: string;
      branchId: string;
    }>
  > {
    const rows = await this.dataSource.query<
      Array<{
        internalOrderId: string;
        orderId: string;
        providerType: 'doctor' | 'care_center';
        doctorId: string | null;
        careCenterId: string | null;
        grossUsd: string | null;
        branchId: string;
        status: string;
        inBatch: boolean;
      }>
    >(
      `SELECT iio.id AS "internalOrderId", iio."orderId", iio."providerType",
              iio."doctorId", iio."careCenterId", iio."providerAmountUsd" AS "grossUsd",
              o."branchId", o.status,
              EXISTS(SELECT 1 FROM "accounts_payable_orders" apo WHERE apo."internalOrderId" = iio.id) AS "inBatch"
       FROM "order_internal_orders" iio
       JOIN "orders" o ON o.id = iio."orderId"
       WHERE iio.id = ANY($1)`,
      [internalOrderIds],
    );
    if (rows.length !== internalOrderIds.length) {
      throw new BadRequestException('Alguna orden interna no existe');
    }
    let allowed: Set<string> | null = null;
    if (!user.isSuperAdmin)
      allowed = new Set(await this.resolveUserBranchIds(user));
    for (const r of rows) {
      if (r.status !== 'finalized') {
        throw new BadRequestException(
          'Sólo se pueden pagar órdenes finalizadas',
        );
      }
      if (r.grossUsd === null) {
        throw new BadRequestException(
          'Una orden no tiene monto facturado para su proveedor',
        );
      }
      if (r.inBatch) {
        throw new BadRequestException(
          'Una orden ya está en otro lote. Quitala de ese lote primero.',
        );
      }
      if (allowed && !allowed.has(r.branchId)) {
        throw new ForbiddenException('No tenés acceso a una de las órdenes');
      }
    }
    return rows.map((r) => ({
      internalOrderId: r.internalOrderId,
      orderId: r.orderId,
      providerType: r.providerType,
      doctorId: r.doctorId,
      careCenterId: r.careCenterId,
      grossUsd: r.grossUsd as string,
      branchId: r.branchId,
    }));
  }

  // ---------------------------------------------------------------------------
  // Abonos (la unidad de pago: USD cubiertos + tasa + retención + filas).
  // ---------------------------------------------------------------------------
  async registerSettlement(
    id: string,
    dto: AccountsPayableSettlementDto,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);

    const calc = await this.buildSettlementCalc(batch, dto);
    const payloads = await this.resolveSettlementPayments(dto.payments, calc);

    await this.dataSource.transaction(async (mgr) => {
      const saved = await mgr.save(
        mgr.create(AccountsPayableSettlement, {
          payableId: id,
          settlementDate: dto.settlementDate.slice(0, 10),
          ...this.calcToColumns(calc),
        }),
      );
      for (const payload of payloads) {
        await mgr.save(
          mgr.create(AccountsPayablePayment, {
            ...payload,
            settlementId: saved.id,
          }),
        );
      }
      await this.upsertSettlementRetention(mgr, batch, saved.id, calc);
      // La tasa del último abono pasa a ser la del lote: el saldo pendiente se
      // proyecta a la tasa a la que se está pagando de verdad.
      if (batch.exchangeRateId !== calc.exchangeRateId) {
        await mgr.update(AccountsPayable, id, {
          exchangeRateId: calc.exchangeRateId,
        });
      }
      await this.recomputeBatchStatus(mgr, id);
    });

    return this.findOneBatch(id, user);
  }

  /**
   * Reemplaza por completo un abono (porción cubierta, tasa, retención y filas
   * de pago). Bloqueado si su retención ya fue enterada al SENIAT.
   */
  async editSettlement(
    id: string,
    settlementId: string,
    dto: AccountsPayableSettlementDto,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    const current = (batch.settlements ?? []).find((x) => x.id === settlementId);
    if (!current) throw new NotFoundException('Abono no encontrado en este lote');

    const calc = await this.buildSettlementCalc(batch, dto, settlementId);
    const payloads = await this.resolveSettlementPayments(dto.payments, calc);

    await this.dataSource.transaction(async (mgr) => {
      await mgr.update(AccountsPayableSettlement, settlementId, {
        settlementDate: dto.settlementDate.slice(0, 10),
        ...this.calcToColumns(calc),
      });
      await mgr.query(
        `DELETE FROM "accounts_payable_payments" WHERE "settlementId" = $1`,
        [settlementId],
      );
      for (const payload of payloads) {
        await mgr.save(
          mgr.create(AccountsPayablePayment, { ...payload, settlementId }),
        );
      }
      await this.upsertSettlementRetention(mgr, batch, settlementId, calc);
      await this.recomputeBatchStatus(mgr, id);
    });

    return this.findOneBatch(id, user);
  }

  /**
   * Elimina un abono: sus filas de pago y su obligación SENIAT caen por
   * CASCADE, y el lote vuelve a deber esos USD. Bloqueado si la retención ya
   * fue enterada al SENIAT.
   */
  async deleteSettlement(
    id: string,
    settlementId: string,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (!(batch.settlements ?? []).some((x) => x.id === settlementId)) {
      throw new NotFoundException('Abono no encontrado en este lote');
    }
    await this.dataSource.transaction(async (mgr) => {
      await this.assertRetentionNotEntered(mgr, settlementId);
      await mgr.query(
        `DELETE FROM "accounts_payable_settlements" WHERE id = $1`,
        [settlementId],
      );
      await this.recomputeBatchStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  /**
   * Resuelve las filas de pago del abono y valida que sumen exactamente su
   * neto. Las filas en Bs se registran a la tasa del abono (es la tasa a la
   * que se pagó esa porción); las filas en EUR llevan su propia tasa EUR/Bs.
   */
  private async resolveSettlementPayments(
    payments: AccountsPayablePaymentDto[],
    calc: SettlementCalc,
  ): Promise<Partial<AccountsPayablePayment>[]> {
    const payloads: Partial<AccountsPayablePayment>[] = [];
    for (const p of payments) {
      payloads.push(
        await this.resolvePaymentForSave(
          p.amountCurrency === 'BS'
            ? { ...p, exchangeRateId: calc.exchangeRateId }
            : p,
          calc.exchangeRateId,
        ),
      );
    }
    const totalBs = round2(
      payloads.reduce((acc, pl) => acc + Number(pl.amountInBs ?? 0), 0),
    );
    if (Math.abs(totalBs - calc.netBs) > TOLERANCE_BS) {
      throw new BadRequestException(
        `Las filas de pago suman ${totalBs.toFixed(2)} Bs y el neto del abono es ${calc.netBs.toFixed(2)} Bs (bruto ${calc.grossBs.toFixed(2)} − retención ${calc.retentionBs.toFixed(2)}).`,
      );
    }
    return payloads;
  }

  async deleteBatch(id: string, user: AuthenticatedUser): Promise<void> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    await this.dataSource.transaction(async (mgr) => {
      // Bloquear si alguna retención generada ya fue pagada al SENIAT.
      const blocked = await mgr.query<{ c: string }[]>(
        `SELECT count(*)::int AS c
         FROM "taxes_payable" tp
         JOIN "tax_payment_batches" tpb ON tpb.id = tp."taxPaymentBatchId"
         WHERE tp."sourcePayableId" = $1 AND tpb.status = 'paid'`,
        [id],
      );
      if (Number(blocked[0]?.c ?? 0) > 0) {
        throw new BadRequestException(
          'La retención de este lote ya fue pagada al SENIAT; no se puede anular.',
        );
      }
      // CASCADE limpia pivot de órdenes, abonos, filas de pago y retenciones.
      await mgr.query(`DELETE FROM "accounts_payable" WHERE id = $1`, [id]);
    });
  }

  // ---------------------------------------------------------------------------
  // Recompute + retención.
  // ---------------------------------------------------------------------------
  /**
   * Estado del lote según los USD cubiertos por sus abonos (no los Bs): pagar
   * a otra tasa no mueve el saldo de lo ya abonado.
   */
  private async recomputeBatchStatus(
    mgr: EntityManager,
    id: string,
  ): Promise<void> {
    await mgr.query(
      `WITH g AS (
         SELECT COALESCE(SUM("grossUsd"), 0) AS v
           FROM "accounts_payable_orders" WHERE "payableId" = $1
       ), c AS (
         SELECT COALESCE(SUM("coveredUsd"), 0) AS v
           FROM "accounts_payable_settlements"
          WHERE "payableId" = $1 AND "deletedAt" IS NULL
       )
       UPDATE "accounts_payable" ap
          SET status = CASE
                WHEN c.v > 0 AND c.v + $2 >= g.v THEN 'paid'
                WHEN c.v > 0 THEN 'partially_paid'
                ELSE 'unpaid' END,
              "paidAt" = CASE
                WHEN c.v > 0 AND c.v + $2 >= g.v THEN COALESCE(ap."paidAt", now())
                ELSE NULL END,
              "updatedAt" = now()
         FROM g, c
        WHERE ap.id = $1`,
      [id, TOLERANCE_USD],
    );
  }

  /** Lanza si la retención del abono ya fue enterada al SENIAT. */
  private async assertRetentionNotEntered(
    mgr: EntityManager,
    settlementId: string,
  ): Promise<void> {
    const rows = await mgr.query<{ c: string }[]>(
      `SELECT count(*)::int AS c
         FROM "taxes_payable" tp
         JOIN "tax_payment_batches" tpb ON tpb.id = tp."taxPaymentBatchId"
        WHERE tp."sourceSettlementId" = $1 AND tpb.status = 'paid'`,
      [settlementId],
    );
    if (Number(rows[0]?.c ?? 0) > 0) {
      throw new BadRequestException(
        'La retención de este abono ya fue pagada al SENIAT; no se puede modificar ni eliminar.',
      );
    }
  }

  /**
   * Crea, actualiza o elimina la obligación SENIAT del abono. Nace con el
   * abono (no al terminar de pagar el lote): un lote pagado en dos meses
   * declara en sus dos períodos fiscales.
   */
  private async upsertSettlementRetention(
    mgr: EntityManager,
    batch: AccountsPayable,
    settlementId: string,
    calc: SettlementCalc,
  ): Promise<void> {
    await this.assertRetentionNotEntered(mgr, settlementId);
    const existing = await mgr.query<{ id: string }[]>(
      `SELECT id FROM "taxes_payable" WHERE "sourceSettlementId" = $1`,
      [settlementId],
    );
    const owed = this.appliesRetention(batch) && calc.retentionBs > 0;
    if (existing.length > 0) {
      if (!owed) {
        await mgr.query(`DELETE FROM "taxes_payable" WHERE id = $1`, [
          existing[0].id,
        ]);
        return;
      }
      await mgr.query(
        `UPDATE "taxes_payable"
            SET "personType" = $2, "taxUnitId" = $3, "taxUnitAmountBs" = $4,
                "grossAmountBs" = $5, "taxRate" = $6, "subtrahendBs" = $7,
                "taxAmountBs" = $8, "isCustomAmount" = $9
          WHERE id = $1`,
        [
          existing[0].id,
          calc.personType,
          calc.taxUnitId,
          calc.taxUnitAmountBs.toFixed(2),
          calc.grossBs.toFixed(2),
          calc.taxRate.toFixed(4),
          calc.subtrahendBs.toFixed(2),
          calc.retentionBs.toFixed(2),
          calc.isCustomRetention,
        ],
      );
      return;
    }
    if (!owed) return;
    const seq = await mgr.query<{ nextval: string }[]>(
      `SELECT nextval('taxes_payable_seq') AS nextval`,
    );
    await mgr.query(
      `INSERT INTO "taxes_payable" (
         "taxPayableNumber", "recipientType", "doctorId", "careCenterId",
         "personType", "taxUnitId", "taxUnitAmountBs",
         "grossAmountBs", "taxRate", "subtrahendBs", "taxAmountBs", "isCustomAmount",
         "status", "sourcePayableId", "sourceSettlementId"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'unpaid',$13,$14)`,
      [
        String(seq[0].nextval),
        batch.recipientType,
        batch.doctorId ?? null,
        batch.careCenterId ?? null,
        calc.personType,
        calc.taxUnitId,
        calc.taxUnitAmountBs.toFixed(2),
        calc.grossBs.toFixed(2),
        calc.taxRate.toFixed(4),
        calc.subtrahendBs.toFixed(2),
        calc.retentionBs.toFixed(2),
        calc.isCustomRetention,
        batch.id,
        settlementId,
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Conversión de pagos. La tasa USD/Bs del propio pago (si viene) manda sobre
  // la tasa de pago del lote: permite registrar pagos hechos otro día a la
  // tasa de ese día. Sin tasa propia, cae a la tasa del abono.
  // ---------------------------------------------------------------------------
  private async resolvePaymentForSave(
    p: AccountsPayablePaymentDto,
    usdExchangeRateId?: string | null,
  ): Promise<Partial<AccountsPayablePayment>> {
    const out: Partial<AccountsPayablePayment> = {
      type: p.type,
      paymentDate: p.paymentDate,
      referenceNumber: p.referenceNumber ?? null,
      bankCode: null,
      accountNumber: null,
      exchangeRateId: null,
      amountCurrency: p.amountCurrency,
      amountValue: p.amountValue.toFixed(2),
      amountInUsd: '0',
    };
    let usdCtxId = usdExchangeRateId ?? null;

    if (p.type === 'mobile_payment' || p.type === 'bank_transfer') {
      if (!p.bankCode) throw new BadRequestException('bankCode requerido');
      if (!p.referenceNumber)
        throw new BadRequestException('referenceNumber requerido');
      if (!p.exchangeRateId)
        throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException(
          'Pago móvil/transferencia debe ser en BS',
        );
      const bank = await this.banksRepo.findOne({
        where: { code: p.bankCode },
      });
      if (!bank) throw new BadRequestException('Banco no encontrado');
      const rate = await this.ratesRepo.findOne({
        where: { id: p.exchangeRateId },
      });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('Pago en BS requiere tasa USD/Bs');
      out.bankCode = p.bankCode;
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
    } else if (p.type === 'cash_usd') {
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('cash_usd debe ser en USD');
      if (p.exchangeRateId) {
        const rate = await this.ratesRepo.findOne({
          where: { id: p.exchangeRateId },
        });
        if (!rate || rate.currency !== 'USD')
          throw new BadRequestException('cash_usd requiere tasa USD/Bs');
        usdCtxId = p.exchangeRateId;
      }
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
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('other: amountCurrency debe ser USD');
      out.accountNumber = p.accountNumber ?? null;
      if (p.exchangeRateId) {
        const rate = await this.ratesRepo.findOne({
          where: { id: p.exchangeRateId },
        });
        if (!rate || rate.currency !== 'USD')
          throw new BadRequestException('other requiere tasa USD/Bs');
        out.exchangeRateId = p.exchangeRateId;
        usdCtxId = p.exchangeRateId;
      }
    }

    const usdAmount = await computeAmountInUsd(
      {
        amountValue: p.amountValue,
        amountCurrency: p.amountCurrency,
        exchangeRateId: p.exchangeRateId ?? null,
      },
      this.ratesRepo,
      { usdExchangeRateId: usdCtxId },
    );
    out.amountInUsd = usdAmount.toFixed(2);
    const bsAmount = await computeAmountInBs(
      {
        amountValue: p.amountValue,
        amountCurrency: p.amountCurrency,
        exchangeRateId: p.exchangeRateId ?? null,
      },
      this.ratesRepo,
      { usdExchangeRateId: usdCtxId },
    );
    out.amountInBs = bsAmount.toFixed(2);
    return out;
  }
}

function emptyPage<T>(page: number, limit: number): PaginatedResponse<T> {
  void limit;
  return { data: [], metadata: { total: 0, page, lastPage: 1 } };
}
