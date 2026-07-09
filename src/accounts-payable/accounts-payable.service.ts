import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AccountsPayable } from './entities/accounts-payable.entity';
import { AccountsPayablePayment } from './entities/accounts-payable-payment.entity';
import { AccountsPayableOrder } from './entities/accounts-payable-order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { TaxUnit } from '../tax-units/entities/tax-unit.entity';
import { TaxUnitsService } from '../tax-units/tax-units.service';
import {
  AccountsPayablePaymentDto,
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
import { calcRetention, SeniatPersonType } from '../shared/utils/seniat-retention';

const TOLERANCE_BS = 0.01;
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

interface BatchNet {
  grossUsd: number;
  grossBs: number;
  personType: SeniatPersonType;
  taxUnitId: string;
  taxUnitAmountBs: number;
  taxRate: number;
  subtrahendBs: number;
  retentionBs: number;
  netBs: number;
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
    @InjectRepository(ExchangeRate) private readonly ratesRepo: Repository<ExchangeRate>,
    @InjectRepository(Doctor) private readonly doctorsRepo: Repository<Doctor>,
    private readonly dataSource: DataSource,
    private readonly taxUnits: TaxUnitsService,
  ) {
    void this.paymentsRepo;
    void this.doctorsRepo;
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
  // Pendientes: órdenes internas facturadas, sin lote.
  // ---------------------------------------------------------------------------
  async listPending(
    query: QueryPendingPayableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<PendingPayable>> {
    const { page = 1, limit = 10, search, doctorId, careCenterId, branchId } = query;
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
      metadata: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)) },
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

    const qb = this.repo
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.doctor', 'doctor')
      .leftJoinAndSelect('ap.careCenter', 'careCenter')
      .leftJoinAndSelect('ap.taxUnit', 'taxUnit')
      .leftJoinAndSelect('ap.orders', 'apo')
      .leftJoinAndSelect('apo.internalOrder', 'iio')
      .leftJoinAndSelect('iio.order', 'order')
      .leftJoinAndSelect('order.billingExchangeRate', 'billingRate')
      .leftJoinAndSelect('ap.payments', 'payments')
      .leftJoinAndSelect('payments.exchangeRate', 'paymentRate');

    qb.orderBy(`ap.${sortBy}`, sortDir);

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
    if (careCenterId) qb.andWhere('ap.careCenterId = :careCenterId', { careCenterId });
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

    const offset = (page - 1) * limit;
    qb.skip(offset).take(limit);
    const [data, total] = await qb.getManyAndCount();
    const taxUnitBs = await this.currentTaxUnitBs();
    for (const b of data) this.computeFigures(b, taxUnitBs);
    return {
      data,
      metadata: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async findOneBatch(id: string, user: AuthenticatedUser): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote de cuentas por pagar no encontrado');
    await this.assertVisibility(batch, user);
    this.computeFigures(batch, await this.currentTaxUnitBs());
    return batch;
  }

  private loadBatch(
    mgr: EntityManager,
    id: string,
  ): Promise<AccountsPayable | null> {
    return mgr.findOne(AccountsPayable, {
      where: { id },
      relations: {
        doctor: true,
        careCenter: true,
        taxUnit: true,
        orders: { internalOrder: { order: { branch: true, billingExchangeRate: true } } },
        payments: { exchangeRate: true },
      },
    });
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

  private personTypeOf(batch: AccountsPayable): SeniatPersonType {
    if (batch.recipientType === 'care_center') return 'legal_entity';
    return batch.doctor?.isLegalEntity ? 'legal_entity' : 'natural';
  }

  /** Calcula y adjunta los campos transient (gross/retención/neto/pagado/pendiente). */
  private computeFigures(batch: AccountsPayable, fallbackTaxUnitBs: number): void {
    let grossUsd = 0;
    let grossBs = 0;
    for (const apo of batch.orders ?? []) {
      const g = Number(apo.grossUsd) || 0;
      grossUsd += g;
      const rateBs = Number(
        apo.internalOrder?.order?.billingExchangeRate?.amountBs ?? 0,
      );
      grossBs += g * rateBs;
    }
    grossUsd = round2(grossUsd);
    grossBs = round2(grossBs);
    const taxUnitBs = batch.taxUnit
      ? Number(batch.taxUnit.amountBs)
      : fallbackTaxUnitBs;
    const retention = calcRetention({
      grossBs,
      personType: this.personTypeOf(batch),
      taxUnitBs,
    });
    const netBs = round2(grossBs - retention.taxAmountBs);
    const paidBs = round2(
      (batch.payments ?? []).reduce((s, p) => s + Number(p.amountInBs || 0), 0),
    );
    batch.grossUsd = grossUsd;
    batch.grossBs = grossBs;
    batch.retentionBs = round2(retention.taxAmountBs);
    batch.netBs = netBs;
    batch.paidBs = paidBs;
    batch.pendingBs = Math.max(0, round2(netBs - paidBs));
  }

  /** Bruto/retención/neto autoritativos del lote (Bs), resolviendo tasas faltantes. */
  private async computeNet(batch: AccountsPayable): Promise<BatchNet> {
    if (!batch.orders || batch.orders.length === 0) {
      throw new BadRequestException('El lote no tiene órdenes');
    }
    let grossUsd = 0;
    let grossBs = 0;
    for (const apo of batch.orders) {
      const g = Number(apo.grossUsd) || 0;
      grossUsd += g;
      const order = apo.internalOrder?.order;
      const rateBs = order?.billingExchangeRate
        ? Number(order.billingExchangeRate.amountBs)
        : Number(
            (await resolveUsdRate(this.ratesRepo, order?.billingExchangeRateId ?? null))
              .amountBs,
          );
      if (!Number.isFinite(rateBs) || rateBs <= 0) {
        throw new BadRequestException('Tasa de facturación inválida en una orden del lote');
      }
      grossBs += g * rateBs;
    }
    grossUsd = round2(grossUsd);
    grossBs = round2(grossBs);
    const personType = this.personTypeOf(batch);
    const taxUnit = batch.taxUnit ?? (await this.taxUnits.getCurrentOrThrow());
    const taxUnitAmountBs = Number(taxUnit.amountBs);
    const retention = calcRetention({ grossBs, personType, taxUnitBs: taxUnitAmountBs });
    return {
      grossUsd,
      grossBs,
      personType,
      taxUnitId: taxUnit.id,
      taxUnitAmountBs,
      taxRate: retention.taxRate,
      subtrahendBs: retention.subtrahendBs,
      retentionBs: round2(retention.taxAmountBs),
      netBs: round2(grossBs - retention.taxAmountBs),
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
    const taxUnit = await this.resolveTaxUnit(dto.taxUnitId);

    const id = await this.dataSource.transaction(async (mgr) => {
      const seq = await mgr.query<{ nextval: string }[]>(
        `SELECT nextval('accounts_payable_seq') AS nextval`,
      );
      const payableNumber = String(seq[0].nextval);
      const inserted = await mgr.query<{ id: string }[]>(
        `INSERT INTO "accounts_payable" ("payableNumber", "recipientType", "doctorId", "careCenterId", "taxUnitId", "status")
         VALUES ($1, $2, $3, $4, $5, 'unpaid') RETURNING id`,
        [
          payableNumber,
          dto.recipientType,
          dto.recipientType === 'doctor' ? providerId : null,
          dto.recipientType === 'care_center' ? providerId : null,
          taxUnit.id,
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
    if (batch.status === 'paid') {
      throw new BadRequestException(
        'No se pueden agregar órdenes a un lote pagado. Edita o quita un pago primero.',
      );
    }
    const providerId = batch.recipientType === 'doctor' ? batch.doctorId : batch.careCenterId;
    const rows = await this.validatePendingRows(internalOrderIds, user);
    for (const r of rows) {
      const rPid = r.providerType === 'doctor' ? r.doctorId : r.careCenterId;
      if (r.providerType !== batch.recipientType || rPid !== providerId) {
        throw new BadRequestException('La orden no pertenece al proveedor del lote');
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
    if (batch.status === 'paid') {
      throw new BadRequestException(
        'No se pueden quitar órdenes de un lote pagado. Edita o quita un pago primero.',
      );
    }
    const remaining = (batch.orders ?? []).filter(
      (o) => !internalOrderIds.includes(o.internalOrderId),
    );
    if (remaining.length === 0) {
      throw new BadRequestException(
        'El lote quedaría vacío. Eliminá el lote en su lugar.',
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
   * Cambia la UT del lote y recalcula neto/estado. Bloqueado si ya está pagado
   * (editá o quitá un pago primero): el neto define el cuadre de los pagos.
   */
  async setTaxUnit(
    id: string,
    taxUnitId: string,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (batch.status === 'paid') {
      throw new BadRequestException(
        'El lote ya está pagado. Para cambiar la Unidad Tributaria, edita o elimina un pago primero.',
      );
    }
    const taxUnit = await this.resolveTaxUnit(taxUnitId);
    await this.dataSource.transaction(async (mgr) => {
      await mgr.update(AccountsPayable, id, { taxUnitId: taxUnit.id });
      await this.recomputeBatchStatus(mgr, id);
    });
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
    if (!user.isSuperAdmin) allowed = new Set(await this.resolveUserBranchIds(user));
    for (const r of rows) {
      if (r.status !== 'finalized') {
        throw new BadRequestException('Sólo se pueden pagar órdenes finalizadas');
      }
      if (r.grossUsd === null) {
        throw new BadRequestException('Una orden no tiene monto facturado para su proveedor');
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
  // Pagos.
  // ---------------------------------------------------------------------------
  async registerPayment(
    id: string,
    payments: AccountsPayablePaymentDto[],
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (batch.status === 'paid') {
      throw new BadRequestException(
        'El lote ya está pagado. Para corregir, editá o eliminá un pago.',
      );
    }

    const net = await this.computeNet(batch);
    const usdRateId = batch.orders[0]?.internalOrder?.order?.billingExchangeRateId ?? null;
    const priorPaidBs = round2(
      (batch.payments ?? []).reduce((s, p) => s + Number(p.amountInBs || 0), 0),
    );
    // Resolver primero: valida cada pago y fija su tasa efectiva; el cuadre se
    // hace sobre los mismos montos que se van a persistir.
    const payloads: Partial<AccountsPayablePayment>[] = [];
    for (const p of payments) {
      payloads.push(await this.resolvePaymentForSave(p, usdRateId));
    }
    const newPaymentsBs = round2(
      payloads.reduce((s, pl) => s + Number(pl.amountInBs ?? 0), 0),
    );
    if (newPaymentsBs <= 0) {
      throw new BadRequestException('El monto de los pagos debe ser mayor a 0');
    }
    const cumulativeBs = round2(priorPaidBs + newPaymentsBs);
    if (cumulativeBs - net.netBs > TOLERANCE_BS) {
      throw new BadRequestException(
        `El pago excede el neto a entregar: acumulado Bs ${cumulativeBs.toFixed(2)} > neto Bs ${net.netBs.toFixed(2)} (ya pagado Bs ${priorPaidBs.toFixed(2)} + nuevos Bs ${newPaymentsBs.toFixed(2)}).`,
      );
    }

    await this.dataSource.transaction(async (mgr) => {
      for (const payload of payloads) {
        const saved = await mgr.save(mgr.create(AccountsPayablePayment, payload));
        await mgr.query(
          `INSERT INTO "accounts_payable_payment_links" ("payableId", "paymentId")
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, saved.id],
        );
      }
      await this.recomputeBatchStatus(mgr, id);
    });

    return this.findOneBatch(id, user);
  }

  async editPayment(
    id: string,
    paymentId: string,
    dto: AccountsPayablePaymentDto,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (!(batch.payments ?? []).some((p) => p.id === paymentId)) {
      throw new NotFoundException('Pago no encontrado en este lote');
    }
    const usdRateId = batch.orders[0]?.internalOrder?.order?.billingExchangeRateId ?? null;
    await this.dataSource.transaction(async (mgr) => {
      const payload = await this.resolvePaymentForSave(dto, usdRateId);
      await mgr.update(AccountsPayablePayment, paymentId, payload);
      await this.recomputeBatchStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async deletePayment(
    id: string,
    paymentId: string,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    if (!(batch.payments ?? []).some((p) => p.id === paymentId)) {
      throw new NotFoundException('Pago no encontrado en este lote');
    }
    await this.dataSource.transaction(async (mgr) => {
      await mgr.query(
        `DELETE FROM "accounts_payable_payment_links" WHERE "payableId" = $1 AND "paymentId" = $2`,
        [id, paymentId],
      );
      await mgr.query(`DELETE FROM "accounts_payable_payments" WHERE id = $1`, [paymentId]);
      await this.recomputeBatchStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async deleteBatch(id: string, user: AuthenticatedUser): Promise<void> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertVisibility(batch, user);
    await this.dataSource.transaction(async (mgr) => {
      // Bloquear si la retención generada ya fue pagada al SENIAT.
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
      // Borrar pagos del lote (los links caen por CASCADE al borrar el lote).
      const payIds = (batch.payments ?? []).map((p) => p.id);
      if (payIds.length) {
        await mgr.query(`DELETE FROM "accounts_payable_payments" WHERE id = ANY($1)`, [payIds]);
      }
      // Borrar el lote: CASCADE limpia pivot de órdenes, links y la retención (sourcePayableId).
      await mgr.query(`DELETE FROM "accounts_payable" WHERE id = $1`, [id]);
    });
  }

  // ---------------------------------------------------------------------------
  // Recompute + retención.
  // ---------------------------------------------------------------------------
  private async recomputeBatchStatus(mgr: EntityManager, id: string): Promise<void> {
    const batch = await this.loadBatch(mgr, id);
    if (!batch) return;
    const net = await this.computeNet(batch);
    const cumulativeBs = round2(
      (batch.payments ?? []).reduce((s, p) => s + Number(p.amountInBs || 0), 0),
    );
    let status: 'unpaid' | 'partially_paid' | 'paid';
    if (cumulativeBs + TOLERANCE_BS >= net.netBs && cumulativeBs > 0) status = 'paid';
    else if (cumulativeBs > 0) status = 'partially_paid';
    else status = 'unpaid';

    await mgr.update(AccountsPayable, id, {
      status,
      paidAt: status === 'paid' ? batch.paidAt ?? new Date() : null,
    });

    if (status === 'paid') {
      await this.upsertRetention(mgr, batch, net);
    } else {
      await this.removeRetentionIfReversible(mgr, id);
    }
  }

  /** Crea (o actualiza) la obligación de retención al quedar el lote pagado. */
  private async upsertRetention(
    mgr: EntityManager,
    batch: AccountsPayable,
    net: BatchNet,
  ): Promise<void> {
    const existing = await mgr.query<{ id: string; taxPaymentBatchId: string | null }[]>(
      `SELECT id, "taxPaymentBatchId" FROM "taxes_payable" WHERE "sourcePayableId" = $1`,
      [batch.id],
    );
    if (existing.length > 0) {
      // Ya existe; sólo refrescar montos si aún no está en un lote SENIAT.
      if (!existing[0].taxPaymentBatchId) {
        await mgr.query(
          `UPDATE "taxes_payable"
           SET "personType" = $2, "taxUnitId" = $3, "taxUnitAmountBs" = $4,
               "grossAmountBs" = $5, "taxRate" = $6, "subtrahendBs" = $7, "taxAmountBs" = $8
           WHERE id = $1`,
          [
            existing[0].id,
            net.personType,
            net.taxUnitId,
            net.taxUnitAmountBs.toFixed(2),
            net.grossBs.toFixed(2),
            net.taxRate.toFixed(4),
            net.subtrahendBs.toFixed(2),
            net.retentionBs.toFixed(2),
          ],
        );
      }
      return;
    }
    const seq = await mgr.query<{ nextval: string }[]>(
      `SELECT nextval('taxes_payable_seq') AS nextval`,
    );
    await mgr.query(
      `INSERT INTO "taxes_payable" (
         "taxPayableNumber", "recipientType", "doctorId", "careCenterId",
         "personType", "taxUnitId", "taxUnitAmountBs",
         "grossAmountBs", "taxRate", "subtrahendBs", "taxAmountBs",
         "status", "sourcePayableId"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'unpaid',$12)`,
      [
        String(seq[0].nextval),
        batch.recipientType,
        batch.doctorId ?? null,
        batch.careCenterId ?? null,
        net.personType,
        net.taxUnitId,
        net.taxUnitAmountBs.toFixed(2),
        net.grossBs.toFixed(2),
        net.taxRate.toFixed(4),
        net.subtrahendBs.toFixed(2),
        net.retentionBs.toFixed(2),
        batch.id,
      ],
    );
  }

  /** Al reabrirse el lote (parcial), elimina la retención salvo que ya esté pagada al SENIAT. */
  private async removeRetentionIfReversible(
    mgr: EntityManager,
    batchId: string,
  ): Promise<void> {
    const existing = await mgr.query<
      { id: string; taxPaymentBatchId: string | null; batchStatus: string | null }[]
    >(
      `SELECT tp.id, tp."taxPaymentBatchId", tpb.status AS "batchStatus"
       FROM "taxes_payable" tp
       LEFT JOIN "tax_payment_batches" tpb ON tpb.id = tp."taxPaymentBatchId"
       WHERE tp."sourcePayableId" = $1`,
      [batchId],
    );
    if (existing.length === 0) return;
    if (existing[0].batchStatus === 'paid') {
      throw new BadRequestException(
        'La retención de este lote ya fue pagada al SENIAT; no se puede revertir el pago.',
      );
    }
    await mgr.query(`DELETE FROM "taxes_payable" WHERE id = $1`, [existing[0].id]);
  }

  // ---------------------------------------------------------------------------
  // Conversión de pagos. La tasa USD/Bs del propio pago (si viene) manda sobre
  // la tasa de facturación del lote: permite registrar pagos hechos otro día
  // a la tasa de ese día. Sin tasa propia, cae a la de facturación.
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
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException('Pago móvil/transferencia debe ser en BS');
      const bank = await this.banksRepo.findOne({ where: { code: p.bankCode } });
      if (!bank) throw new BadRequestException('Banco no encontrado');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('Pago en BS requiere tasa USD/Bs');
      out.bankCode = p.bankCode;
      out.exchangeRateId = p.exchangeRateId;
      usdCtxId = p.exchangeRateId;
    } else if (p.type === 'cash_bs') {
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS') throw new BadRequestException('cash_bs debe ser en BS');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('cash_bs requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
      usdCtxId = p.exchangeRateId;
    } else if (p.type === 'cash_usd') {
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('cash_usd debe ser en USD');
      if (p.exchangeRateId) {
        const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
        if (!rate || rate.currency !== 'USD')
          throw new BadRequestException('cash_usd requiere tasa USD/Bs');
        usdCtxId = p.exchangeRateId;
      }
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
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('other: amountCurrency debe ser USD');
      out.accountNumber = p.accountNumber ?? null;
      if (p.exchangeRateId) {
        const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
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
