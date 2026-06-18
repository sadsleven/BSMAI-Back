import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { AccountsPayable } from '../accounts-payable/entities/accounts-payable.entity';
import { AccountsReceivable } from '../accounts-receivable/entities/accounts-receivable.entity';
import { AccountsPayablePayment } from '../accounts-payable/entities/accounts-payable-payment.entity';
import { AccountsReceivablePayment } from '../accounts-receivable/entities/accounts-receivable-payment.entity';
import { TaxPayable } from '../taxes-payable/entities/tax-payable.entity';
import { TaxPayablePayment } from '../taxes-payable/entities/tax-payable-payment.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Patient) private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(ExchangeRate) private readonly ratesRepo: Repository<ExchangeRate>,
    @InjectRepository(AccountsPayable)
    private readonly apRepo: Repository<AccountsPayable>,
    @InjectRepository(AccountsReceivable)
    private readonly arRepo: Repository<AccountsReceivable>,
    @InjectRepository(AccountsPayablePayment)
    private readonly apPaymentsRepo: Repository<AccountsPayablePayment>,
    @InjectRepository(AccountsReceivablePayment)
    private readonly arPaymentsRepo: Repository<AccountsReceivablePayment>,
    @InjectRepository(TaxPayable)
    private readonly tpRepo: Repository<TaxPayable>,
    @InjectRepository(TaxPayablePayment)
    private readonly tpPaymentsRepo: Repository<TaxPayablePayment>,
    private readonly dataSource: DataSource,
  ) {
    void this.ratesRepo;
    void this.tpPaymentsRepo;
  }

  async patientsActiveCount(): Promise<{ count: number }> {
    const count = await this.patientsRepo.count({
      where: { isActive: true, deletedAt: IsNull() },
    });
    return { count };
  }

  async ordersTodayCount(user: AuthenticatedUser): Promise<{ count: number }> {
    const today = isoDate(new Date());
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .where('o.appointmentDate >= :from', { from: today })
      .andWhere('o.appointmentDate <= :to', { to: today })
      .andWhere('o.deletedAt IS NULL');
    await this.applyBranchScope(qb, user);
    const count = await qb.getCount();
    return { count };
  }

  async ordersPendingCount(user: AuthenticatedUser): Promise<{ count: number }> {
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .where('o.status NOT IN (:...excluded)', { excluded: ['finalized', 'cancelled'] })
      .andWhere('o.deletedAt IS NULL');
    await this.applyBranchScope(qb, user);
    const count = await qb.getCount();
    return { count };
  }

  /**
   * Ganancia neta USD del mes (= Σ `priceAmount − doctorAmount` para órdenes
   * finalizadas del mes). Todo en USD nativo.
   */
  async billedMonthUsd(
    user: AuthenticatedUser,
  ): Promise<{ amount: number; currency: 'USD' }> {
    const { from, to } = monthRangeIso();
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .where('o.status = :st', { st: 'finalized' })
      .andWhere('o.orderDate >= :from', { from })
      .andWhere('o.orderDate <= :to', { to })
      .andWhere('o.deletedAt IS NULL');
    await this.applyBranchScope(qb, user);
    const orders = await qb.getMany();
    const total = orders.reduce((sum, o) => sum + netProfitUsd(o), 0);
    return { amount: +total.toFixed(2), currency: 'USD' };
  }

  /** Suma USD cobrado este mes (Σ AR payments.amountInUsd con paymentDate en mes). */
  async collectedMonthUsd(
    user: AuthenticatedUser,
  ): Promise<{ amount: number; currency: 'USD' }> {
    const { from, to } = monthRangeIso();
    const qb = this.arPaymentsRepo
      .createQueryBuilder('p')
      .innerJoin('accounts_receivable_payment_links', 'lnk', 'lnk."paymentId" = p.id')
      .innerJoin(
        'accounts_receivable',
        'ar',
        'ar.id = lnk."receivableId" AND ar."deletedAt" IS NULL',
      )
      .where('p."paymentDate" >= :from', { from })
      .andWhere('p."paymentDate" <= :to', { to });
    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else
        qb.andWhere(
          `EXISTS (SELECT 1 FROM "accounts_receivable_orders" aro
                   JOIN "orders" o ON o.id = aro."orderId" AND o."deletedAt" IS NULL
                   WHERE aro."receivableId" = ar.id AND o."branchId" IN (:...allowed))`,
          { allowed },
        );
    }
    const result = await qb
      .select('COALESCE(SUM(p."amountInUsd"), 0)', 'total')
      .getRawOne<{ total: string }>();
    const amount = +Number(result?.total ?? 0).toFixed(2);
    return { amount, currency: 'USD' };
  }

  /**
   * Total USD por cobrar pendiente. Por lote (no cobrado del todo): target USD
   * (Σ pivot `targetUsd`, o `priceAmount` para órdenes con tasa fija) − cobrado
   * USD. Aproximación del KPI (los lotes con tasa fija se valoran a priceAmount).
   */
  async receivableTotalUsd(
    user: AuthenticatedUser,
  ): Promise<{ amount: number; currency: 'USD' }> {
    const params: unknown[] = [];
    let branchSql = '';
    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) return { amount: 0, currency: 'USD' };
      params.push(allowed);
      branchSql = `AND EXISTS (SELECT 1 FROM "accounts_receivable_orders" aro2
                     JOIN "orders" o2 ON o2.id = aro2."orderId" AND o2."deletedAt" IS NULL
                     WHERE aro2."receivableId" = ar.id AND o2."branchId" = ANY($1))`;
    }
    const rows = await this.dataSource.query<{ target: string; paid: string }[]>(
      `SELECT
         (SELECT COALESCE(SUM(COALESCE(aro."targetUsd", o."priceAmount")), 0)
            FROM "accounts_receivable_orders" aro
            JOIN "orders" o ON o.id = aro."orderId"
           WHERE aro."receivableId" = ar.id) AS target,
         (SELECT COALESCE(SUM(p."amountInUsd"), 0)
            FROM "accounts_receivable_payment_links" l
            JOIN "accounts_receivable_payments" p ON p.id = l."paymentId" AND p."deletedAt" IS NULL
           WHERE l."receivableId" = ar.id) AS paid
       FROM "accounts_receivable" ar
       WHERE ar."deletedAt" IS NULL
         AND ar.status IN ('uncollected','partially_collected')
         ${branchSql}`,
      params,
    );
    const total = rows.reduce(
      (s, r) => s + Math.max(0, Number(r.target) - Number(r.paid)),
      0,
    );
    return { amount: +total.toFixed(2), currency: 'USD' };
  }

  /**
   * Total USD por pagar pendiente. Por lote (no pagado del todo): bruto USD
   * (Σ pivot `grossUsd`) − pagado USD. Bruto: la retención SENIAT se contabiliza
   * aparte (retenciones por pagar).
   */
  async payableTotalUsd(
    user: AuthenticatedUser,
  ): Promise<{ amount: number; currency: 'USD' }> {
    const params: unknown[] = [];
    let branchSql = '';
    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) return { amount: 0, currency: 'USD' };
      params.push(allowed);
      branchSql = `AND EXISTS (SELECT 1 FROM "accounts_payable_orders" apo2
                     JOIN "order_internal_orders" iio2 ON iio2.id = apo2."internalOrderId"
                     JOIN "orders" o2 ON o2.id = iio2."orderId" AND o2."deletedAt" IS NULL
                     WHERE apo2."payableId" = ap.id AND o2."branchId" = ANY($1))`;
    }
    const rows = await this.dataSource.query<{ gross: string; paid: string }[]>(
      `SELECT
         (SELECT COALESCE(SUM(apo."grossUsd"), 0)
            FROM "accounts_payable_orders" apo WHERE apo."payableId" = ap.id) AS gross,
         (SELECT COALESCE(SUM(p."amountInUsd"), 0)
            FROM "accounts_payable_payment_links" l
            JOIN "accounts_payable_payments" p ON p.id = l."paymentId" AND p."deletedAt" IS NULL
           WHERE l."payableId" = ap.id) AS paid
       FROM "accounts_payable" ap
       WHERE ap."deletedAt" IS NULL
         AND ap.status IN ('unpaid','partially_paid')
         ${branchSql}`,
      params,
    );
    const total = rows.reduce(
      (s, r) => s + Math.max(0, Number(r.gross) - Number(r.paid)),
      0,
    );
    return { amount: +total.toFixed(2), currency: 'USD' };
  }

  /**
   * Total Bs por pagar de retenciones SENIAT (Σ taxAmountBs − Σ amountInBs
   * pagado). Las retenciones se declaran y pagan en Bs (SENIAT), por lo que el
   * dashboard las muestra en su moneda nativa, sin convertir a USD.
   */
  async taxesPayableTotalBs(): Promise<{ amount: number; currency: 'BS' }> {
    // Adeudado = Σ retención de obligaciones no pagadas; menos lo ya abonado en
    // lotes SENIAT aún no pagados del todo.
    const owedRows = await this.tpRepo
      .createQueryBuilder('tp')
      .where('tp.status != :paid', { paid: 'paid' })
      .andWhere('tp."deletedAt" IS NULL')
      .select('COALESCE(SUM(tp."taxAmountBs"), 0)', 'owed')
      .getRawOne<{ owed: string }>();
    const paidRows = await this.dataSource.query<{ paid: string }[]>(
      `SELECT COALESCE(SUM(p."amountInBs"), 0) AS paid
       FROM "tax_payment_batch_payment_links" l
       JOIN "taxes_payable_payments" p ON p.id = l."paymentId" AND p."deletedAt" IS NULL
       JOIN "tax_payment_batches" b ON b.id = l."batchId"
       WHERE b.status != 'paid' AND b."deletedAt" IS NULL`,
    );
    const totalBs = Math.max(
      0,
      Number(owedRows?.owed ?? 0) - Number(paidRows[0]?.paid ?? 0),
    );
    return { amount: +totalBs.toFixed(2), currency: 'BS' };
  }

  private async applyBranchScope(
    qb: ReturnType<Repository<Order>['createQueryBuilder']>,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = await this.resolveUserBranchIds(user);
    if (allowed.length === 0) {
      qb.andWhere('1 = 0');
      return;
    }
    qb.andWhere('o.branchId IN (:...allowed)', { allowed });
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

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthRangeIso(): { from: string; to: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    from: isoDate(new Date(y, m, 1)),
    to: isoDate(new Date(y, m + 1, 0)),
  };
}

function netProfitUsd(o: Order): number {
  const price = Number(o.priceAmount);
  if (!Number.isFinite(price) || price <= 0) return 0;
  const docAmount = Number(o.doctorAmount ?? 0);
  if (!Number.isFinite(docAmount) || docAmount <= 0) return price;
  return price - docAmount;
}
