import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { OrderPayment } from '../orders/entities/order-payment.entity';
import { AccountsReceivablePayment } from '../accounts-receivable/entities/accounts-receivable-payment.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { QueryInflowsDto } from './dto/query-inflows.dto';

/** Una fila de detalle: un pago recibido en una cuenta propia. */
export interface InflowRow {
  id: string;
  source: 'order' | 'receivable';
  paymentDate: string;
  type: string;
  referenceNumber: string | null;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
  paymentAccountType: string | null;
  bankCode: string | null;
  amountValue: number;
  amountCurrency: string;
  amountInUsd: number;
  /** N° de orden o cuenta por cobrar de origen. */
  documentNumber: string;
  /** Contraparte: paciente/titular (orden) o aseguradora/titular (AR). */
  counterpart: string;
}

/** Agregación por cuenta propia. */
export interface InflowByAccount {
  paymentAccountId: string;
  paymentAccountName: string;
  paymentAccountType: string;
  bankCode: string | null;
  isActive: boolean;
  deletedAt: string | null;
  ordersCount: number;
  ordersUsd: number;
  receivablesCount: number;
  receivablesUsd: number;
  totalCount: number;
  totalUsd: number;
}

export interface InflowsReport {
  totals: {
    totalCount: number;
    totalUsd: number;
    ordersCount: number;
    ordersUsd: number;
    receivablesCount: number;
    receivablesUsd: number;
  };
  byAccount: InflowByAccount[];
  rows: InflowRow[];
  /** True si `rows` fue truncado por el cap. */
  truncated: boolean;
}

const ROWS_CAP = 5000;

/**
 * Reporte de dinero recibido en las cuentas propias de AFMI
 * (`payment_accounts`). Combina pagos entrantes de:
 *  - `order_payments` (primera cuota / contado de órdenes)
 *  - `accounts_receivable_payments` (cobros a seguros / titulares)
 *
 * Sólo cuenta pagos con `paymentAccountId` no nulo (mobile_payment,
 * bank_transfer, other). Respeta el alcance por sucursal del usuario.
 */
@Injectable()
export class PaymentAccountReportsService {
  constructor(
    @InjectRepository(OrderPayment)
    private readonly orderPaymentsRepo: Repository<OrderPayment>,
    @InjectRepository(AccountsReceivablePayment)
    private readonly arPaymentsRepo: Repository<AccountsReceivablePayment>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    private readonly dataSource: DataSource,
  ) {}

  async inflows(
    query: QueryInflowsDto,
    user: AuthenticatedUser,
  ): Promise<InflowsReport> {
    const source = query.source ?? 'all';
    const allowed = user.isSuperAdmin ? null : await this.resolveUserBranchIds(user);

    const rows: InflowRow[] = [];

    if (source === 'all' || source === 'orders') {
      rows.push(...(await this.orderRows(query, allowed)));
    }
    if (source === 'all' || source === 'receivables') {
      rows.push(...(await this.receivableRows(query, allowed)));
    }

    rows.sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));

    const truncated = rows.length > ROWS_CAP;
    const capped = truncated ? rows.slice(0, ROWS_CAP) : rows;

    const byAccountMap = new Map<string, InflowByAccount>();
    const totals = {
      totalCount: 0,
      totalUsd: 0,
      ordersCount: 0,
      ordersUsd: 0,
      receivablesCount: 0,
      receivablesUsd: 0,
    };

    for (const r of rows) {
      if (!r.paymentAccountId) continue;
      totals.totalCount += 1;
      totals.totalUsd += r.amountInUsd;
      if (r.source === 'order') {
        totals.ordersCount += 1;
        totals.ordersUsd += r.amountInUsd;
      } else {
        totals.receivablesCount += 1;
        totals.receivablesUsd += r.amountInUsd;
      }

      let agg = byAccountMap.get(r.paymentAccountId);
      if (!agg) {
        agg = {
          paymentAccountId: r.paymentAccountId,
          paymentAccountName: r.paymentAccountName ?? '—',
          paymentAccountType: r.paymentAccountType ?? '—',
          bankCode: r.bankCode,
          isActive: true,
          deletedAt: null,
          ordersCount: 0,
          ordersUsd: 0,
          receivablesCount: 0,
          receivablesUsd: 0,
          totalCount: 0,
          totalUsd: 0,
        };
        byAccountMap.set(r.paymentAccountId, agg);
      }
      agg.totalCount += 1;
      agg.totalUsd += r.amountInUsd;
      if (r.source === 'order') {
        agg.ordersCount += 1;
        agg.ordersUsd += r.amountInUsd;
      } else {
        agg.receivablesCount += 1;
        agg.receivablesUsd += r.amountInUsd;
      }
    }

    // Enriquecer estado de cada cuenta (isActive / deletedAt).
    const accountIds = Array.from(byAccountMap.keys());
    if (accountIds.length) {
      const meta = await this.dataSource
        .createQueryBuilder()
        .select('pa.id', 'id')
        .addSelect('pa."isActive"', 'isActive')
        .addSelect('pa."deletedAt"', 'deletedAt')
        .from('payment_accounts', 'pa')
        .where('pa.id IN (:...ids)', { ids: accountIds })
        .getRawMany<{ id: string; isActive: boolean; deletedAt: Date | null }>();
      for (const m of meta) {
        const agg = byAccountMap.get(m.id);
        if (agg) {
          agg.isActive = m.isActive;
          agg.deletedAt = m.deletedAt ? new Date(m.deletedAt).toISOString() : null;
        }
      }
    }

    const round2 = (n: number) => +n.toFixed(2);
    totals.totalUsd = round2(totals.totalUsd);
    totals.ordersUsd = round2(totals.ordersUsd);
    totals.receivablesUsd = round2(totals.receivablesUsd);

    const byAccount = Array.from(byAccountMap.values())
      .map((a) => ({
        ...a,
        ordersUsd: round2(a.ordersUsd),
        receivablesUsd: round2(a.receivablesUsd),
        totalUsd: round2(a.totalUsd),
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    return { totals, byAccount, rows: capped, truncated };
  }

  private async orderRows(
    query: QueryInflowsDto,
    allowed: string[] | null,
  ): Promise<InflowRow[]> {
    const qb = this.orderPaymentsRepo
      .createQueryBuilder('op')
      .innerJoin('orders', 'o', 'o.id = op."orderId" AND o."deletedAt" IS NULL')
      .leftJoin('patients', 'h', 'h.id = o."holderId"')
      .leftJoin('payment_accounts', 'pa', 'pa.id = op."paymentAccountId"')
      .where('op."paymentAccountId" IS NOT NULL')
      .andWhere('op."deletedAt" IS NULL');

    this.applyCommonFilters(qb, 'op', query);
    if (allowed) {
      if (!allowed.length) qb.andWhere('1 = 0');
      else qb.andWhere('o."branchId" IN (:...allowed)', { allowed });
    }

    const raw = await qb
      .select('op.id', 'id')
      .addSelect('op."paymentDate"', 'paymentDate')
      .addSelect('op.type', 'type')
      .addSelect('op."referenceNumber"', 'referenceNumber')
      .addSelect('op."paymentAccountId"', 'paymentAccountId')
      .addSelect('pa.name', 'paymentAccountName')
      .addSelect('pa.type', 'paymentAccountType')
      .addSelect('op."bankCode"', 'bankCode')
      .addSelect('op."amountValue"', 'amountValue')
      .addSelect('op."amountCurrency"', 'amountCurrency')
      .addSelect('op."amountInUsd"', 'amountInUsd')
      .addSelect('o."orderNumber"', 'documentNumber')
      .addSelect(
        `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', h."firstName", h."lastName")), ''), h."businessName", '—')`,
        'counterpart',
      )
      .getRawMany<RawRow>();

    return raw.map((r) => this.mapRow(r, 'order'));
  }

  private async receivableRows(
    query: QueryInflowsDto,
    allowed: string[] | null,
  ): Promise<InflowRow[]> {
    const qb = this.arPaymentsRepo
      .createQueryBuilder('p')
      .innerJoin(
        'accounts_receivable_payment_links',
        'lnk',
        'lnk."paymentId" = p.id',
      )
      .innerJoin(
        'accounts_receivable',
        'ar',
        'ar.id = lnk."receivableId" AND ar."deletedAt" IS NULL',
      )
      .innerJoin('orders', 'o', 'o.id = ar."orderId" AND o."deletedAt" IS NULL')
      .leftJoin('insurances', 'ins', 'ins.id = ar."insuranceId"')
      .leftJoin('patients', 'h', 'h.id = ar."holderId"')
      .leftJoin('payment_accounts', 'pa', 'pa.id = p."paymentAccountId"')
      .where('p."paymentAccountId" IS NOT NULL')
      .andWhere('p."deletedAt" IS NULL');

    this.applyCommonFilters(qb, 'p', query);
    if (allowed) {
      if (!allowed.length) qb.andWhere('1 = 0');
      else qb.andWhere('o."branchId" IN (:...allowed)', { allowed });
    }

    const raw = await qb
      .select('p.id', 'id')
      .addSelect('p."paymentDate"', 'paymentDate')
      .addSelect('p.type', 'type')
      .addSelect('p."referenceNumber"', 'referenceNumber')
      .addSelect('p."paymentAccountId"', 'paymentAccountId')
      .addSelect('pa.name', 'paymentAccountName')
      .addSelect('pa.type', 'paymentAccountType')
      .addSelect('p."bankCode"', 'bankCode')
      .addSelect('p."amountValue"', 'amountValue')
      .addSelect('p."amountCurrency"', 'amountCurrency')
      .addSelect('p."amountInUsd"', 'amountInUsd')
      .addSelect('ar."receivableNumber"', 'documentNumber')
      .addSelect(
        `COALESCE(ins.name, NULLIF(TRIM(CONCAT_WS(' ', h."firstName", h."lastName")), ''), h."businessName", '—')`,
        'counterpart',
      )
      // Una AR-payment puede enlazarse a varias cuentas (N:N). Para el reporte
      // de dinero recibido lo contamos una sola vez por pago.
      .distinct(true)
      .getRawMany<RawRow>();

    // Dedupe defensivo por id (distinct sobre múltiples columnas igual deja 1).
    const seen = new Set<string>();
    const out: InflowRow[] = [];
    for (const r of raw) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(this.mapRow(r, 'receivable'));
    }
    return out;
  }

  private applyCommonFilters(
    qb: SelectQueryBuilder<OrderPayment | AccountsReceivablePayment>,
    alias: string,
    query: QueryInflowsDto,
  ): void {
    if (query.from) {
      qb.andWhere(`${alias}."paymentDate" >= :from`, { from: query.from });
    }
    if (query.to) {
      qb.andWhere(`${alias}."paymentDate" <= :to`, { to: query.to });
    }
    if (query.paymentAccountId) {
      qb.andWhere(`${alias}."paymentAccountId" = :paId`, {
        paId: query.paymentAccountId,
      });
    }
    if (query.type) {
      qb.andWhere(`${alias}.type = :ptype`, { ptype: query.type });
    }
  }

  private mapRow(r: RawRow, source: 'order' | 'receivable'): InflowRow {
    return {
      id: r.id,
      source,
      paymentDate: r.paymentDate,
      type: r.type,
      referenceNumber: r.referenceNumber ?? null,
      paymentAccountId: r.paymentAccountId ?? null,
      paymentAccountName: r.paymentAccountName ?? null,
      paymentAccountType: r.paymentAccountType ?? null,
      bankCode: r.bankCode ?? null,
      amountValue: Number(r.amountValue ?? 0),
      amountCurrency: r.amountCurrency,
      amountInUsd: Number(r.amountInUsd ?? 0),
      documentNumber: r.documentNumber ?? '—',
      counterpart: r.counterpart ?? '—',
    };
  }

  private async resolveUserBranchIds(user: AuthenticatedUser): Promise<string[]> {
    if (user.isSuperAdmin) {
      const all = await this.branchesRepo.find({
        where: { isActive: true, deletedAt: IsNull() },
        select: ['id'],
      });
      return all.map((b) => b.id);
    }
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('b.id', 'id')
      .from('user_branches', 'ub')
      .innerJoin('branches', 'b', 'b.id = ub."branchId"')
      .where('ub."userId" = :uid', { uid: user.id })
      .andWhere('b."isActive" = true')
      .andWhere('b."deletedAt" IS NULL')
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }
}

interface RawRow {
  id: string;
  paymentDate: string;
  type: string;
  referenceNumber: string | null;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
  paymentAccountType: string | null;
  bankCode: string | null;
  amountValue: string;
  amountCurrency: string;
  amountInUsd: string;
  documentNumber: string | null;
  counterpart: string | null;
}
