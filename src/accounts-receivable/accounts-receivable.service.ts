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
import { targetBsForOrder, targetUsdForOrder } from './ar-targets';

// Re-export para compatibilidad con specs/consumidores existentes.
export {
  casheaCommissionForOrder,
  targetUsdForOrder,
  targetBsForOrder,
} from './ar-targets';

const TOLERANCE_USD = 0.01;
const TOLERANCE_BS = 0.01;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Orden finalizada con deudor, disponible para armar un lote (Pendiente). */
export interface PendingReceivable {
  orderId: string;
  orderNumber: string;
  orderType: string;
  debtorType: 'insurance' | 'holder';
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
    @InjectRepository(ExchangeRate) private readonly ratesRepo: Repository<ExchangeRate>,
    private readonly dataSource: DataSource,
    private readonly paymentAccounts: PaymentAccountsService,
  ) {
    void this.paymentsRepo;
    void this.banksRepo;
  }

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

  // ---------------------------------------------------------------------------
  // Pendientes.
  // ---------------------------------------------------------------------------
  async listPending(
    query: QueryPendingReceivableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<PendingReceivable>> {
    const { page = 1, limit = 10, search, debtorType, insuranceId, holderId, branchId } =
      query;
    const params: unknown[] = [];
    const where: string[] = [
      `o.status = 'finalized'`,
      `o."deletedAt" IS NULL`,
      `((o."type" = 'insurance' AND o."insuranceId" IS NOT NULL)
        OR (o."type" IN ('credit','cashea') AND o."holderId" IS NOT NULL))`,
      `NOT EXISTS (SELECT 1 FROM "accounts_receivable_orders" aro WHERE aro."orderId" = o.id)`,
    ];

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0)
        return { data: [], metadata: { total: 0, page, lastPage: 1 } };
      params.push(allowed);
      where.push(`o."branchId" = ANY($${params.length})`);
    }
    if (debtorType === 'insurance') where.push(`o."type" = 'insurance'`);
    if (debtorType === 'holder') where.push(`o."type" IN ('credit','cashea')`);
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
      `SELECT count(*)::int AS c FROM "orders" o WHERE ${whereSql}`,
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
        casheaFirstInstallmentRate: string | null;
        casheaTotalRate: string | null;
        fixedRateBs: string | null;
        branchId: string;
        branchName: string | null;
        createdAt: string;
      }>
    >(
      `SELECT o.id AS "orderId", o."orderNumber", o."type" AS "orderType",
              o."insuranceId", o."holderId", i."name" AS "insuranceName",
              p."firstName", p."lastName", p."businessName", p."cedula", p."rif",
              o."useFixedRate", o."priceAmount",
              o."casheaFirstInstallmentAmount", o."casheaFirstInstallmentRate", o."casheaTotalRate",
              fx."amountBs" AS "fixedRateBs",
              o."branchId", b."name" AS "branchName", o."createdAt"
       FROM "orders" o
       LEFT JOIN "insurances" i ON i.id = o."insuranceId"
       LEFT JOIN "patients" p ON p.id = o."holderId"
       LEFT JOIN "branches" b ON b.id = o."branchId"
       LEFT JOIN "exchange_rates" fx ON fx.id = o."fixedExchangeRateId"
       WHERE ${whereSql}
       ORDER BY o."orderNumber"::int DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    const data: PendingReceivable[] = rows.map((r) => {
      const orderLike = {
        type: r.orderType,
        priceAmount: r.priceAmount,
        casheaFirstInstallmentAmount: r.casheaFirstInstallmentAmount,
        casheaFirstInstallmentRate: r.casheaFirstInstallmentRate,
        casheaTotalRate: r.casheaTotalRate,
        useFixedRate: r.useFixedRate,
        fixedExchangeRate: r.fixedRateBs != null ? { amountBs: r.fixedRateBs } : null,
      } as unknown as Order;
      const debtorType: 'insurance' | 'holder' =
        r.orderType === 'insurance' ? 'insurance' : 'holder';
      const debtorName =
        debtorType === 'insurance'
          ? r.insuranceName ?? '—'
          : r.businessName ?? (`${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || '—');
      return {
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        orderType: r.orderType,
        debtorType,
        insuranceId: r.insuranceId,
        holderId: r.holderId,
        debtorName,
        useFixedRate: r.useFixedRate,
        targetUsd: r.useFixedRate ? null : targetUsdForOrder(orderLike),
        targetBs: r.useFixedRate ? targetBsForOrder(orderLike) : null,
        branchId: r.branchId,
        branchName: r.branchName,
        createdAt: r.createdAt,
      };
    });

    return {
      data,
      metadata: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)) },
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

    const qb = this.repo
      .createQueryBuilder('ar')
      .leftJoinAndSelect('ar.insurance', 'insurance')
      .leftJoinAndSelect('ar.holder', 'holder')
      .leftJoinAndSelect('ar.orders', 'aro')
      .leftJoinAndSelect('aro.order', 'order')
      .leftJoinAndSelect('ar.payments', 'payments')
      .leftJoinAndSelect('payments.exchangeRate', 'paymentRate');

    qb.orderBy(`ar.${sortBy}`, sortDir);

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
    if (insuranceId) qb.andWhere('ar.insuranceId = :insuranceId', { insuranceId });
    if (holderId) qb.andWhere('ar.holderId = :holderId', { holderId });
    if (debtorType === 'insurance') qb.andWhere('ar.insuranceId IS NOT NULL');
    if (debtorType === 'holder') qb.andWhere('ar.holderId IS NOT NULL');
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

    const offset = (page - 1) * limit;
    qb.skip(offset).take(limit);
    const [data, total] = await qb.getManyAndCount();
    for (const b of data) this.computeFigures(b);
    return {
      data,
      metadata: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOneBatch(id: string, user: AuthenticatedUser): Promise<AccountsReceivable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote de cuentas por cobrar no encontrado');
    await this.assertVisibility(batch, user);
    this.computeFigures(batch);
    return batch;
  }

  private loadBatch(mgr: EntityManager, id: string): Promise<AccountsReceivable | null> {
    return mgr.findOne(AccountsReceivable, {
      where: { id },
      relations: {
        insurance: true,
        holder: { phones: true },
        orders: { order: { branch: true } },
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
      throw new ForbiddenException('No tenés acceso a este lote');
    }
  }

  private computeFigures(batch: AccountsReceivable): void {
    const pivots = batch.orders ?? [];
    const mode: 'usd' | 'fixed' = pivots.some((o) => o.useFixedRate) ? 'fixed' : 'usd';
    batch.mode = mode;
    if (mode === 'fixed') {
      const targetBs = round2(pivots.reduce((s, o) => s + Number(o.targetBs || 0), 0));
      const collectedBs = round2(
        (batch.payments ?? []).reduce((s, p) => s + Number(p.amountInBs || 0), 0),
      );
      batch.targetBs = targetBs;
      batch.collectedBs = collectedBs;
      batch.pendingBs = Math.max(0, round2(targetBs - collectedBs));
    } else {
      const targetUsd = round2(pivots.reduce((s, o) => s + Number(o.targetUsd || 0), 0));
      const collectedUsd = round2(
        (batch.payments ?? []).reduce((s, p) => s + Number(p.amountInUsd || 0), 0),
      );
      batch.targetUsd = targetUsd;
      batch.collectedUsd = collectedUsd;
      batch.pendingUsd = Math.max(0, round2(targetUsd - collectedUsd));
    }
  }

  // ---------------------------------------------------------------------------
  // Crear / mutar lote.
  // ---------------------------------------------------------------------------
  async createBatch(
    dto: CreateAccountsReceivableBatchDto,
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable> {
    const debtorId = dto.debtorType === 'insurance' ? dto.insuranceId : dto.holderId;
    if (!debtorId) {
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
          dto.debtorType === 'holder' ? debtorId : null,
        ],
      );
      const batchId = inserted[0].id;
      for (const r of rows) {
        await mgr.query(
          `INSERT INTO "accounts_receivable_orders"
             ("receivableId", "orderId", "useFixedRate", "targetUsd", "targetBs")
           VALUES ($1, $2, $3, $4, $5)`,
          [
            batchId,
            r.orderId,
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
        'No se pueden agregar órdenes a un lote ya cobrado. Editá o quitá un cobro primero.',
      );
    }
    const debtorType: 'insurance' | 'holder' = batch.insuranceId ? 'insurance' : 'holder';
    const dtoLike = {
      debtorType,
      insuranceId: batch.insuranceId ?? undefined,
      holderId: batch.holderId ?? undefined,
    } as CreateAccountsReceivableBatchDto;
    const existingMode: 'usd' | 'fixed' = (batch.orders ?? []).some((o) => o.useFixedRate)
      ? 'fixed'
      : 'usd';
    const rows = await this.validatePendingOrders(orderIds, dtoLike, user, existingMode);
    await this.dataSource.transaction(async (mgr) => {
      for (const r of rows) {
        await mgr.query(
          `INSERT INTO "accounts_receivable_orders"
             ("receivableId", "orderId", "useFixedRate", "targetUsd", "targetBs")
           VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            r.orderId,
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
    const remaining = (batch.orders ?? []).filter((o) => !orderIds.includes(o.orderId));
    if (remaining.length === 0) {
      throw new BadRequestException('El lote quedaría vacío. Eliminá el lote en su lugar.');
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

  /** Valida órdenes pendientes: existencia, finalizada, deudor uniforme, modo uniforme, sin lote, visible. */
  private async validatePendingOrders(
    orderIds: string[],
    dto: CreateAccountsReceivableBatchDto,
    user: AuthenticatedUser,
    forcedMode?: 'usd' | 'fixed',
  ): Promise<
    Array<{
      orderId: string;
      useFixedRate: boolean;
      targetUsd: number | null;
      targetBs: number | null;
    }>
  > {
    const orders = await this.ordersRepo.find({
      where: { id: In(orderIds) },
      relations: { fixedExchangeRate: true },
    });
    if (orders.length !== orderIds.length) {
      throw new BadRequestException('Alguna orden no existe');
    }
    const inBatch = await this.dataSource.query<{ orderId: string }[]>(
      `SELECT "orderId" FROM "accounts_receivable_orders" WHERE "orderId" = ANY($1)`,
      [orderIds],
    );
    const inBatchSet = new Set(inBatch.map((r) => r.orderId));
    let allowed: Set<string> | null = null;
    if (!user.isSuperAdmin) allowed = new Set(await this.resolveUserBranchIds(user));

    const debtorId = dto.debtorType === 'insurance' ? dto.insuranceId : dto.holderId;
    const out: Array<{
      orderId: string;
      useFixedRate: boolean;
      targetUsd: number | null;
      targetBs: number | null;
    }> = [];
    for (const o of orders) {
      if (o.status !== 'finalized') {
        throw new BadRequestException('Sólo se pueden cobrar órdenes finalizadas');
      }
      if (inBatchSet.has(o.id)) {
        throw new BadRequestException(
          'Una orden ya está en otro lote. Quitala de ese lote primero.',
        );
      }
      if (allowed && !allowed.has(o.branchId)) {
        throw new ForbiddenException('No tenés acceso a una de las órdenes');
      }
      // Deudor uniforme.
      const oDebtorType: 'insurance' | 'holder' =
        o.type === 'insurance' ? 'insurance' : 'holder';
      const oDebtorId = oDebtorType === 'insurance' ? o.insuranceId : o.holderId;
      if (oDebtorType !== dto.debtorType || oDebtorId !== debtorId) {
        throw new BadRequestException(
          'Todas las órdenes del lote deben ser del mismo deudor seleccionado',
        );
      }
      // Modo uniforme.
      if (forcedMode && (forcedMode === 'fixed') !== o.useFixedRate) {
        throw new BadRequestException(
          'No se puede mezclar órdenes con tasa fija (Bs) y en USD en un mismo lote',
        );
      }
      out.push({
        orderId: o.id,
        useFixedRate: o.useFixedRate,
        targetUsd: o.useFixedRate ? null : targetUsdForOrder(o),
        targetBs: o.useFixedRate ? targetBsForOrder(o) : null,
      });
    }
    // Modo uniforme dentro del propio set.
    const fixed = out.filter((r) => r.useFixedRate).length;
    if (fixed > 0 && fixed < out.length) {
      throw new BadRequestException(
        'No se puede mezclar órdenes con tasa fija (Bs) y en USD en un mismo lote',
      );
    }
    if (out.some((r) => r.useFixedRate && r.targetBs == null)) {
      throw new BadRequestException('Una orden con tasa fija no tiene tasa snapshot');
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

    const usdRateId = batch.orders[0]?.order?.billingExchangeRateId ?? null;
    this.computeFigures(batch); // fija batch.mode según las órdenes del lote
    const newTotal =
      batch.mode === 'fixed'
        ? await this.computePaymentsTotalBs(payments, usdRateId)
        : await this.computePaymentsTotalUsd(payments, usdRateId);
    if (newTotal <= 0) {
      throw new BadRequestException('El monto de los cobros debe ser mayor a 0');
    }

    await this.dataSource.transaction(async (mgr) => {
      for (const p of payments) {
        const payload = await this.resolvePaymentForSave(p, usdRateId);
        const saved = await mgr.save(mgr.create(AccountsReceivablePayment, payload));
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
    const usdRateId = batch.orders[0]?.order?.billingExchangeRateId ?? null;
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
      await mgr.query(`DELETE FROM "accounts_receivable_payments" WHERE id = $1`, [paymentId]);
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
        await mgr.query(`DELETE FROM "accounts_receivable_payments" WHERE id = ANY($1)`, [
          payIds,
        ]);
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
    let status: 'uncollected' | 'partially_collected' | 'collected' | 'overcollected';
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
        ? batch.collectedAt ?? new Date()
        : null;
    await mgr.update(AccountsReceivable, id, { status, collectedAt });
  }

  // ---------------------------------------------------------------------------
  // Conversión de cobros (sin cambios respecto al modelo anterior).
  // ---------------------------------------------------------------------------
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
        p.type as 'mobile_payment' | 'bank_transfer' | 'bank_transfer_usd' | 'card' | 'other',
      );
      out.paymentAccountId = account.id;
      out.bankCode = account.bankCode ?? null;
      out.accountNumber = account.accountNumber ?? null;
    } else if (p.paymentAccountId) {
      throw new BadRequestException(
        `Cobros de tipo ${p.type} no pueden referenciar una cuenta de pago`,
      );
    }

    if (p.type === 'mobile_payment' || p.type === 'bank_transfer' || p.type === 'card') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException('Pago móvil/transferencia/punto debe ser en BS');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('Cobro en BS requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'cash_bs') {
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS') throw new BadRequestException('cash_bs debe ser en BS');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('cash_bs requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'bank_transfer_usd') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('Transferencia en dólares debe ser en USD');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_usd') {
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('cash_usd debe ser en USD');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_eur') {
      if (p.amountCurrency !== 'EUR')
        throw new BadRequestException('cash_eur debe ser en EUR');
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido (EUR)');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'EUR')
        throw new BadRequestException('cash_eur requiere una tasa de cambio en EUR');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'other') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency === 'BS' || p.amountCurrency === 'EUR') {
        if (!p.exchangeRateId)
          throw new BadRequestException(
            `exchangeRateId requerido para cobro other en ${p.amountCurrency}`,
          );
        const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
        if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
        if (p.amountCurrency === 'BS' && rate.currency !== 'USD')
          throw new BadRequestException('other en BS requiere tasa USD/Bs');
        if (p.amountCurrency === 'EUR' && rate.currency !== 'EUR')
          throw new BadRequestException('other en EUR requiere tasa EUR/Bs');
        out.exchangeRateId = p.exchangeRateId;
      }
    }

    const conversionInput = {
      amountValue: p.amountValue,
      amountCurrency: p.amountCurrency,
      exchangeRateId: p.exchangeRateId ?? null,
    };
    const usdAmount = await computeAmountInUsd(conversionInput, this.ratesRepo, {
      usdExchangeRateId: usdExchangeRateId ?? null,
    });
    out.amountInUsd = usdAmount.toFixed(2);
    const bsAmount = await computeAmountInBs(conversionInput, this.ratesRepo, {
      usdExchangeRateId: usdExchangeRateId ?? null,
    });
    out.amountInBs = bsAmount.toFixed(2);
    return out;
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
        { usdExchangeRateId },
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
        { usdExchangeRateId },
      );
    }
    return round2(total);
  }
}
