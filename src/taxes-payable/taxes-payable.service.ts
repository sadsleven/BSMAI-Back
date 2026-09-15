import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  TaxPayable,
  TaxPayableInvoiceRow,
} from './entities/tax-payable.entity';
import { TaxPayablePayment } from './entities/tax-payable-payment.entity';
import { TaxPaymentBatch } from './entities/tax-payment-batch.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { TaxUnitsService } from '../tax-units/tax-units.service';
import { calcRetention } from '../shared/utils/seniat-retention';
import {
  CreateTaxBatchDto,
  QueryPendingTaxDto,
  QueryTaxesPayableDto,
  TaxPayablePaymentDto,
} from './dto/register-tax-payment.dto';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { computeAmountInBs } from '../shared/utils/payment-conversion';

const TOLERANCE_BS = 0.01;
const round2 = (n: number): number => Math.round(n * 100) / 100;

@Injectable()
export class TaxesPayableService {
  constructor(
    @InjectRepository(TaxPayable)
    private readonly repo: Repository<TaxPayable>,
    @InjectRepository(TaxPayablePayment)
    private readonly paymentsRepo: Repository<TaxPayablePayment>,
    @InjectRepository(TaxPaymentBatch)
    private readonly batchRepo: Repository<TaxPaymentBatch>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(ExchangeRate)
    private readonly ratesRepo: Repository<ExchangeRate>,
    private readonly dataSource: DataSource,
    private readonly taxUnits: TaxUnitsService,
  ) {
    void this.paymentsRepo;
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

  /** EXISTS de scope sucursal: la retención cuelga de su lote AP → órdenes internas → órdenes. */
  private branchScopeExists(alias: string): string {
    return `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_s
              JOIN "order_internal_orders" iio_s ON iio_s.id = apo_s."internalOrderId"
              JOIN "orders" o_s ON o_s.id = iio_s."orderId"
              WHERE apo_s."payableId" = ${alias}."sourcePayableId" AND o_s."branchId" IN (:...allowed))`;
  }

  // ---------------------------------------------------------------------------
  // Pendientes: obligaciones de retención sin lote.
  // ---------------------------------------------------------------------------
  async listPending(
    query: QueryPendingTaxDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<TaxPayable>> {
    const {
      page = 1,
      limit = 10,
      search,
      doctorId,
      careCenterId,
      branchId,
    } = query;
    const qb = this.repo
      .createQueryBuilder('tp')
      .leftJoinAndSelect('tp.doctor', 'doctor')
      .leftJoinAndSelect('tp.careCenter', 'careCenter')
      .where('tp."taxPaymentBatchId" IS NULL');

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0)
        return { data: [], metadata: { total: 0, page, lastPage: 1 } };
      qb.andWhere(this.branchScopeExists('tp'), { allowed });
    }
    if (doctorId) qb.andWhere('tp."doctorId" = :doctorId', { doctorId });
    if (careCenterId)
      qb.andWhere('tp."careCenterId" = :careCenterId', { careCenterId });
    if (branchId) qb.andWhere(this.branchScopeExistsSingle('tp'), { branchId });
    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(tp."taxPayableNumber") LIKE :s
          OR EXISTS (SELECT 1 FROM "accounts_payable_orders" apo2
                     JOIN "order_internal_orders" iio2 ON iio2.id = apo2."internalOrderId"
                     WHERE apo2."payableId" = tp."sourcePayableId" AND LOWER(iio2."internalNumber") LIKE :s))`,
        { s },
      );
    }
    qb.orderBy('tp.taxPayableNumber', 'DESC');
    const offset = (page - 1) * limit;
    qb.skip(offset).take(limit);
    const [data, total] = await qb.getManyAndCount();
    await this.attachInternalNumbers(data);
    return {
      data,
      metadata: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  private branchScopeExistsSingle(alias: string): string {
    return `EXISTS (SELECT 1 FROM "accounts_payable_orders" apo_b
              JOIN "order_internal_orders" iio_b ON iio_b.id = apo_b."internalOrderId"
              JOIN "orders" o_b ON o_b.id = iio_b."orderId"
              WHERE apo_b."payableId" = ${alias}."sourcePayableId" AND o_b."branchId" = :branchId)`;
  }

  /** Popula `internalNumbers` en cada obligación desde su lote AP de origen. */
  private async attachInternalNumbers(taxes: TaxPayable[]): Promise<void> {
    const sourceIds = Array.from(
      new Set(taxes.map((t) => t.sourcePayableId).filter(Boolean) as string[]),
    );
    if (!sourceIds.length) {
      for (const t of taxes) t.internalNumbers = [];
      return;
    }
    const rows = await this.dataSource.query<
      Array<{ payableId: string; internalNumber: string }>
    >(
      `SELECT apo."payableId", iio."internalNumber"
       FROM "accounts_payable_orders" apo
       JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
       WHERE apo."payableId" = ANY($1)
       ORDER BY iio."internalNumber"::int`,
      [sourceIds],
    );
    const byPayable = new Map<string, string[]>();
    for (const r of rows) {
      const arr = byPayable.get(r.payableId) ?? [];
      arr.push(r.internalNumber);
      byPayable.set(r.payableId, arr);
    }
    for (const t of taxes) {
      t.internalNumbers = t.sourcePayableId
        ? (byPayable.get(t.sourcePayableId) ?? [])
        : [];
    }
  }

  /**
   * Popula `invoices` en cada obligación: facturas de las órdenes del lote AP
   * de origen (para las filas del comprobante ISLR). Bs = grossUsd × tasa de
   * pago del lote (o, en lotes previos sin ella, la de facturación de cada
   * orden) — misma regla que `grossAmountBs` de la obligación.
   */
  private async attachInvoiceRows(taxes: TaxPayable[]): Promise<void> {
    const sourceIds = Array.from(
      new Set(taxes.map((t) => t.sourcePayableId).filter(Boolean) as string[]),
    );
    if (!sourceIds.length) {
      for (const t of taxes) t.invoices = [];
      return;
    }
    const rows = await this.dataSource.query<
      Array<{
        payableId: string;
        internalNumber: string;
        orderId: string;
        orderNumber: string;
        invoiceNumber: string | null;
        controlNumber: string | null;
        invoiceDate: string;
        grossUsd: number;
        rateBs: number | null;
      }>
    >(
      `SELECT apo."payableId", iio."internalNumber", o.id AS "orderId",
              o."orderNumber", o."invoiceNumber", o."controlNumber",
              o."updatedAt" AS "invoiceDate",
              apo."grossUsd"::float8 AS "grossUsd",
              COALESCE(per."amountBs", er."amountBs")::float8 AS "rateBs"
       FROM "accounts_payable_orders" apo
       JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
       JOIN "orders" o ON o.id = iio."orderId"
       JOIN "accounts_payable" ap ON ap.id = apo."payableId"
       LEFT JOIN "exchange_rates" per ON per.id = ap."exchangeRateId"
       LEFT JOIN "exchange_rates" er ON er.id = o."billingExchangeRateId"
       WHERE apo."payableId" = ANY($1)
       ORDER BY iio."internalNumber"::int`,
      [sourceIds],
    );
    const byPayable = new Map<string, TaxPayableInvoiceRow[]>();
    for (const r of rows) {
      const arr = byPayable.get(r.payableId) ?? [];
      arr.push({
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        internalNumber: r.internalNumber,
        invoiceNumber: r.invoiceNumber,
        controlNumber: r.controlNumber,
        invoiceDate: r.invoiceDate,
        grossBs: round2((Number(r.grossUsd) || 0) * (Number(r.rateBs) || 0)),
      });
      byPayable.set(r.payableId, arr);
    }
    for (const t of taxes) {
      t.invoices = t.sourcePayableId
        ? (byPayable.get(t.sourcePayableId) ?? [])
        : [];
    }
  }

  // ---------------------------------------------------------------------------
  // Lotes SENIAT.
  // ---------------------------------------------------------------------------
  async listBatches(
    query: QueryTaxesPayableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<TaxPaymentBatch>> {
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

    const qb = this.batchRepo
      .createQueryBuilder('tpb')
      .leftJoinAndSelect('tpb.adjustmentTaxUnit', 'adjustmentTaxUnit')
      .leftJoinAndSelect('tpb.obligations', 'obl')
      .leftJoinAndSelect('obl.doctor', 'oblDoctor')
      .leftJoinAndSelect('obl.careCenter', 'oblCareCenter')
      .leftJoinAndSelect('tpb.payments', 'payments')
      .leftJoinAndSelect('payments.exchangeRate', 'paymentRate');

    qb.orderBy(`tpb.${sortBy}`, sortDir);

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else
        qb.andWhere(
          `EXISTS (SELECT 1 FROM "taxes_payable" tp2
                   JOIN "accounts_payable_orders" apo2 ON apo2."payableId" = tp2."sourcePayableId"
                   JOIN "order_internal_orders" iio2 ON iio2.id = apo2."internalOrderId"
                   JOIN "orders" o2 ON o2.id = iio2."orderId"
                   WHERE tp2."taxPaymentBatchId" = tpb.id AND o2."branchId" IN (:...allowed))`,
          { allowed },
        );
    }
    if (status) qb.andWhere('tpb.status = :status', { status });
    // Un lote puede tener varios proveedores → filtrar por EXISTS sobre sus obligaciones.
    if (doctorId)
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "taxes_payable" tpd WHERE tpd."taxPaymentBatchId" = tpb.id AND tpd."doctorId" = :doctorId)`,
        { doctorId },
      );
    if (careCenterId)
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "taxes_payable" tpc WHERE tpc."taxPaymentBatchId" = tpb.id AND tpc."careCenterId" = :careCenterId)`,
        { careCenterId },
      );
    if (branchId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM "taxes_payable" tp3
                 JOIN "accounts_payable_orders" apo3 ON apo3."payableId" = tp3."sourcePayableId"
                 JOIN "order_internal_orders" iio3 ON iio3.id = apo3."internalOrderId"
                 JOIN "orders" o3 ON o3.id = iio3."orderId"
                 WHERE tp3."taxPaymentBatchId" = tpb.id AND o3."branchId" = :branchId)`,
        { branchId },
      );
    }
    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(tpb."taxBatchNumber") LIKE :s
          OR EXISTS (SELECT 1 FROM "taxes_payable" tp4 WHERE tp4."taxPaymentBatchId" = tpb.id AND LOWER(tp4."taxPayableNumber") LIKE :s))`,
        { s },
      );
    }

    const offset = (page - 1) * limit;
    qb.skip(offset).take(limit);
    const [data, total] = await qb.getManyAndCount();
    for (const b of data) {
      this.computeFigures(b);
      await this.attachInternalNumbers(b.obligations ?? []);
    }
    return {
      data,
      metadata: {
        total,
        page,
        lastPage: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOneBatch(
    id: string,
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote SENIAT no encontrado');
    await this.assertBatchVisibility(batch, user);
    this.computeFigures(batch);
    await this.attachInternalNumbers(batch.obligations ?? []);
    await this.attachInvoiceRows(batch.obligations ?? []);
    return batch;
  }

  private loadBatch(
    mgr: EntityManager,
    id: string,
  ): Promise<TaxPaymentBatch | null> {
    return mgr.findOne(TaxPaymentBatch, {
      where: { id },
      relations: {
        adjustmentTaxUnit: true,
        obligations: { taxUnit: true, doctor: true, careCenter: true },
        payments: { exchangeRate: true },
      },
    });
  }

  private computeFigures(batch: TaxPaymentBatch): void {
    const originalTargetBs = round2(
      (batch.obligations ?? []).reduce(
        (s, o) => s + Number(o.taxAmountBs || 0),
        0,
      ),
    );
    // Ajuste de UT: el monto a enterar al SENIAT se recalcula por obligación
    // con la UT del ajuste; el snapshot (lo retenido al proveedor) no cambia.
    let targetBs = originalTargetBs;
    const adjustedUtBs = batch.adjustmentTaxUnit
      ? Number(batch.adjustmentTaxUnit.amountBs)
      : 0;
    if (adjustedUtBs > 0) {
      targetBs = 0;
      for (const o of batch.obligations ?? []) {
        const r = calcRetention({
          grossBs: Number(o.grossAmountBs || 0),
          personType: o.personType,
          taxUnitBs: adjustedUtBs,
        });
        o.adjustedTaxAmountBs = r.taxAmountBs;
        o.adjustedSubtrahendBs = r.subtrahendBs;
        targetBs += r.taxAmountBs;
      }
      targetBs = round2(targetBs);
    }
    const paidBs = round2(
      (batch.payments ?? []).reduce((s, p) => s + Number(p.amountInBs || 0), 0),
    );
    batch.targetBs = targetBs;
    batch.originalTargetBs = originalTargetBs;
    batch.paidBs = paidBs;
    batch.pendingBs = Math.max(0, round2(targetBs - paidBs));
  }

  private async assertBatchVisibility(
    batch: TaxPaymentBatch,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = new Set(await this.resolveUserBranchIds(user));
    const sourceIds = (batch.obligations ?? [])
      .map((o) => o.sourcePayableId)
      .filter(Boolean) as string[];
    if (sourceIds.length === 0) {
      throw new ForbiddenException('No tenés acceso a este lote');
    }
    const rows = await this.dataSource.query<{ branchId: string }[]>(
      `SELECT DISTINCT o."branchId"
       FROM "accounts_payable_orders" apo
       JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
       JOIN "orders" o ON o.id = iio."orderId"
       WHERE apo."payableId" = ANY($1)`,
      [sourceIds],
    );
    if (rows.length === 0 || rows.some((r) => !allowed.has(r.branchId))) {
      throw new ForbiddenException('No tenés acceso a este lote');
    }
  }

  // ---------------------------------------------------------------------------
  // Crear / mutar lote.
  // ---------------------------------------------------------------------------
  async createBatch(
    dto: CreateTaxBatchDto,
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    await this.validateObligations(dto.taxPayableIds, user);

    const id = await this.dataSource.transaction(async (mgr) => {
      const seq = await mgr.query<{ nextval: string }[]>(
        `SELECT nextval('tax_payment_batch_seq') AS nextval`,
      );
      const inserted = await mgr.query<{ id: string }[]>(
        `INSERT INTO "tax_payment_batches" ("taxBatchNumber", "status")
         VALUES ($1, 'unpaid') RETURNING id`,
        [String(seq[0].nextval)],
      );
      const batchId = inserted[0].id;
      await mgr.query(
        `UPDATE "taxes_payable" SET "taxPaymentBatchId" = $1 WHERE id = ANY($2)`,
        [batchId, dto.taxPayableIds],
      );
      return batchId;
    });

    return this.findOneBatch(id, user);
  }

  async addObligations(
    id: string,
    taxPayableIds: string[],
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertBatchVisibility(batch, user);
    if (batch.status === 'paid') {
      throw new BadRequestException(
        'No se pueden agregar retenciones a un lote pagado. Edita o quita un pago primero.',
      );
    }
    await this.validateObligations(taxPayableIds, user);
    await this.dataSource.transaction(async (mgr) => {
      await mgr.query(
        `UPDATE "taxes_payable" SET "taxPaymentBatchId" = $1 WHERE id = ANY($2)`,
        [id, taxPayableIds],
      );
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async removeObligations(
    id: string,
    taxPayableIds: string[],
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertBatchVisibility(batch, user);
    if (batch.status === 'paid') {
      throw new BadRequestException(
        'No se pueden quitar retenciones de un lote pagado. Edita o quita un pago primero.',
      );
    }
    const remaining = (batch.obligations ?? []).filter(
      (o) => !taxPayableIds.includes(o.id),
    );
    if (remaining.length === 0) {
      throw new BadRequestException(
        'El lote quedaría vacío. Elimina el lote en su lugar.',
      );
    }
    await this.dataSource.transaction(async (mgr) => {
      await mgr.query(
        `UPDATE "taxes_payable" SET "taxPaymentBatchId" = NULL, "status" = 'unpaid', "paidAt" = NULL
         WHERE id = ANY($1) AND "taxPaymentBatchId" = $2`,
        [taxPayableIds, id],
      );
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  /**
   * Fija o quita el ajuste de UT del lote. El monto a pagar al SENIAT se
   * recalcula con la UT elegida (útil si la UT subió entre pagar la cuenta por
   * pagar — que ya no se puede modificar — y enterar la retención).
   */
  async setAdjustment(
    id: string,
    taxUnitId: string | null,
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertBatchVisibility(batch, user);
    if (batch.status === 'paid') {
      throw new BadRequestException(
        'El lote ya está pagado. Para ajustar la Unidad Tributaria, edita o elimina un pago primero.',
      );
    }
    let resolvedId: string | null = null;
    if (taxUnitId) {
      const ut = await this.taxUnits.findOne(taxUnitId);
      if (!ut.isActive) {
        throw new BadRequestException(
          'La Unidad Tributaria seleccionada está deshabilitada',
        );
      }
      resolvedId = ut.id;
    }
    await this.dataSource.transaction(async (mgr) => {
      await mgr.update(TaxPaymentBatch, id, {
        adjustmentTaxUnitId: resolvedId,
      });
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  /** Guarda los datos del comprobante ISLR del lote (documentales, sin efecto en montos). */
  async setComprobante(
    id: string,
    comprobanteNumber: string,
    issueDate: string,
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertBatchVisibility(batch, user);
    const trimmed = comprobanteNumber.trim();
    if (!trimmed) {
      throw new BadRequestException('El N° de comprobante es requerido');
    }
    await this.batchRepo.update(id, {
      comprobanteNumber: trimmed,
      comprobanteIssueDate: issueDate.slice(0, 10),
    });
    return this.findOneBatch(id, user);
  }

  private async validateObligations(
    taxPayableIds: string[],
    user: AuthenticatedUser,
  ): Promise<void> {
    const taxes = await this.repo.find({
      where: { id: In(taxPayableIds) },
    });
    if (taxes.length !== taxPayableIds.length) {
      throw new BadRequestException('Alguna retención no existe');
    }
    // Un lote SENIAT puede mezclar proveedores: el pago va al fisco, no al
    // proveedor. Sólo se valida que no estén ya en otro lote.
    for (const t of taxes) {
      if (t.taxPaymentBatchId) {
        throw new BadRequestException(
          'Una retención ya está en otro lote. Quitala de ese lote primero.',
        );
      }
    }
    if (!user.isSuperAdmin) {
      const allowed = new Set(await this.resolveUserBranchIds(user));
      const sourceIds = taxes
        .map((t) => t.sourcePayableId)
        .filter(Boolean) as string[];
      if (sourceIds.length) {
        const rows = await this.dataSource.query<{ branchId: string }[]>(
          `SELECT DISTINCT o."branchId"
           FROM "accounts_payable_orders" apo
           JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
           JOIN "orders" o ON o.id = iio."orderId"
           WHERE apo."payableId" = ANY($1)`,
          [sourceIds],
        );
        if (rows.some((r) => !allowed.has(r.branchId))) {
          throw new ForbiddenException(
            'No tenés acceso a una de las retenciones',
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Pagos al SENIAT.
  // ---------------------------------------------------------------------------
  async registerPayment(
    id: string,
    payments: TaxPayablePaymentDto[],
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertBatchVisibility(batch, user);
    if (batch.status === 'paid') {
      throw new BadRequestException(
        'El lote ya está pagado. Para corregir, editá o eliminá un pago.',
      );
    }
    this.computeFigures(batch);
    const usdRateId = await this.usdRateForBatch(batch);
    const priorPaidBs = batch.paidBs ?? 0;
    const newPaymentsBs = await this.computePaymentsTotalBs(
      payments,
      usdRateId,
    );
    if (newPaymentsBs <= 0) {
      throw new BadRequestException('El monto de los pagos debe ser mayor a 0');
    }
    const cumulativeBs = round2(priorPaidBs + newPaymentsBs);
    const targetBs = batch.targetBs ?? 0;
    if (cumulativeBs - targetBs > TOLERANCE_BS) {
      throw new BadRequestException(
        `El total de pagos (Bs ${cumulativeBs.toFixed(2)}) excede el monto a pagar al SENIAT (Bs ${targetBs.toFixed(2)})`,
      );
    }

    await this.dataSource.transaction(async (mgr) => {
      for (const p of payments) {
        const payload = await this.resolvePaymentForSave(p, usdRateId);
        const saved = await mgr.save(mgr.create(TaxPayablePayment, payload));
        await mgr.query(
          `INSERT INTO "tax_payment_batch_payment_links" ("batchId", "paymentId")
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
    dto: TaxPayablePaymentDto,
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertBatchVisibility(batch, user);
    if (!(batch.payments ?? []).some((p) => p.id === paymentId)) {
      throw new NotFoundException('Pago no encontrado en este lote');
    }
    const usdRateId = await this.usdRateForBatch(batch);
    await this.dataSource.transaction(async (mgr) => {
      const payload = await this.resolvePaymentForSave(dto, usdRateId);
      await mgr.update(TaxPayablePayment, paymentId, payload);
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async deletePayment(
    id: string,
    paymentId: string,
    user: AuthenticatedUser,
  ): Promise<TaxPaymentBatch> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertBatchVisibility(batch, user);
    if (!(batch.payments ?? []).some((p) => p.id === paymentId)) {
      throw new NotFoundException('Pago no encontrado en este lote');
    }
    await this.dataSource.transaction(async (mgr) => {
      await mgr.query(
        `DELETE FROM "tax_payment_batch_payment_links" WHERE "batchId" = $1 AND "paymentId" = $2`,
        [id, paymentId],
      );
      await mgr.query(`DELETE FROM "taxes_payable_payments" WHERE id = $1`, [
        paymentId,
      ]);
      await this.recomputeStatus(mgr, id);
    });
    return this.findOneBatch(id, user);
  }

  async deleteBatch(id: string, user: AuthenticatedUser): Promise<void> {
    const batch = await this.loadBatch(this.dataSource.manager, id);
    if (!batch) throw new NotFoundException('Lote no encontrado');
    await this.assertBatchVisibility(batch, user);
    await this.dataSource.transaction(async (mgr) => {
      // Liberar obligaciones (vuelven a Pendientes).
      await mgr.query(
        `UPDATE "taxes_payable" SET "taxPaymentBatchId" = NULL, "status" = 'unpaid', "paidAt" = NULL
         WHERE "taxPaymentBatchId" = $1`,
        [id],
      );
      const payIds = (batch.payments ?? []).map((p) => p.id);
      if (payIds.length) {
        await mgr.query(
          `DELETE FROM "taxes_payable_payments" WHERE id = ANY($1)`,
          [payIds],
        );
      }
      await mgr.query(`DELETE FROM "tax_payment_batches" WHERE id = $1`, [id]);
    });
  }

  // ---------------------------------------------------------------------------
  // Recompute.
  // ---------------------------------------------------------------------------
  private async recomputeStatus(mgr: EntityManager, id: string): Promise<void> {
    const batch = await this.loadBatch(mgr, id);
    if (!batch) return;
    this.computeFigures(batch);
    const target = batch.targetBs ?? 0;
    const paid = batch.paidBs ?? 0;
    let status: 'unpaid' | 'partially_paid' | 'paid';
    if (paid + TOLERANCE_BS >= target && paid > 0) status = 'paid';
    else if (paid > 0) status = 'partially_paid';
    else status = 'unpaid';

    const paidAt = status === 'paid' ? (batch.paidAt ?? new Date()) : null;
    await mgr.update(TaxPaymentBatch, id, { status, paidAt });
    // Las obligaciones espejan el estado del lote.
    await mgr.query(
      `UPDATE "taxes_payable" SET "status" = $2, "paidAt" = $3 WHERE "taxPaymentBatchId" = $1`,
      [id, status, status === 'paid' ? paidAt : null],
    );
  }

  private async usdRateForBatch(
    batch: TaxPaymentBatch,
  ): Promise<string | null> {
    const sourceIds = (batch.obligations ?? [])
      .map((o) => o.sourcePayableId)
      .filter(Boolean) as string[];
    if (!sourceIds.length) return null;
    const rows = await this.dataSource.query<
      { billingExchangeRateId: string | null }[]
    >(
      `SELECT o."billingExchangeRateId"
       FROM "accounts_payable_orders" apo
       JOIN "order_internal_orders" iio ON iio.id = apo."internalOrderId"
       JOIN "orders" o ON o.id = iio."orderId"
       WHERE apo."payableId" = $1
       LIMIT 1`,
      [sourceIds[0]],
    );
    return rows[0]?.billingExchangeRateId ?? null;
  }

  // ---------------------------------------------------------------------------
  // Conversión de pagos (sin cambios respecto al modelo anterior).
  // ---------------------------------------------------------------------------
  private async resolvePaymentForSave(
    p: TaxPayablePaymentDto,
    usdExchangeRateId?: string | null,
  ): Promise<Partial<TaxPayablePayment>> {
    const out: Partial<TaxPayablePayment> = {
      type: p.type,
      paymentDate: p.paymentDate,
      referenceNumber: p.referenceNumber ?? null,
      bankCode: null,
      accountNumber: null,
      exchangeRateId: null,
      amountCurrency: p.amountCurrency,
      amountValue: p.amountValue.toFixed(2),
      amountInBs: '0',
    };

    if (p.type === 'mobile_payment' || p.type === 'bank_transfer') {
      if (!p.bankCode) throw new BadRequestException('bankCode requerido');
      if (!p.referenceNumber)
        throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException(
          'Pago móvil/transferencia debe ser en BS',
        );
      const bank = await this.banksRepo.findOne({
        where: { code: p.bankCode },
      });
      if (!bank) throw new BadRequestException('Banco no encontrado');
      out.bankCode = p.bankCode;
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_bs') {
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException('cash_bs debe ser en BS');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_usd') {
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('cash_usd debe ser en USD');
      if (!p.exchangeRateId)
        throw new BadRequestException(
          'cash_usd requiere tasa USD/Bs (para convertir a Bs)',
        );
      const rate = await this.ratesRepo.findOne({
        where: { id: p.exchangeRateId },
      });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('cash_usd requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
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
      out.accountNumber = p.accountNumber ?? null;
      if (p.amountCurrency !== 'BS' && !p.exchangeRateId) {
        throw new BadRequestException(
          'Pago "other" en USD/EUR requiere exchangeRateId',
        );
      }
      out.exchangeRateId = p.exchangeRateId ?? null;
    }

    const bsAmount = await computeAmountInBs(
      {
        amountValue: p.amountValue,
        amountCurrency: p.amountCurrency,
        exchangeRateId: p.exchangeRateId ?? null,
      },
      this.ratesRepo,
      { usdExchangeRateId: usdExchangeRateId ?? null },
    );
    out.amountInBs = bsAmount.toFixed(2);
    return out;
  }

  private async computePaymentsTotalBs(
    payments: TaxPayablePaymentDto[],
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
}
