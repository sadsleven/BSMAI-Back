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
      .innerJoin('orders', 'o', 'o.id = ar."orderId" AND o."deletedAt" IS NULL')
      .where('p."paymentDate" >= :from', { from })
      .andWhere('p."paymentDate" <= :to', { to });
    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('o."branchId" IN (:...allowed)', { allowed });
    }
    const result = await qb
      .select('COALESCE(SUM(p."amountInUsd"), 0)', 'total')
      .getRawOne<{ total: string }>();
    const amount = +Number(result?.total ?? 0).toFixed(2);
    return { amount, currency: 'USD' };
  }

  /** Total USD por cobrar pendiente (Σ priceAmount − Σ amountInUsd cobrado, no negativo). */
  async receivableTotalUsd(
    user: AuthenticatedUser,
  ): Promise<{ amount: number; currency: 'USD' }> {
    const qb = this.arRepo
      .createQueryBuilder('ar')
      .innerJoin('ar.order', 'o')
      .where('ar.status IN (:...statuses)', {
        statuses: ['uncollected', 'partially_collected'],
      })
      .andWhere('ar."deletedAt" IS NULL')
      .andWhere('o."deletedAt" IS NULL')
      .leftJoin('ar.payments', 'p');
    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('o."branchId" IN (:...allowed)', { allowed });
    }
    const rows = await qb
      .select('ar.id', 'id')
      .addSelect('o."priceAmount"', 'priceAmount')
      .addSelect('COALESCE(SUM(p."amountInUsd"), 0)', 'paid')
      .groupBy('ar.id')
      .addGroupBy('o."priceAmount"')
      .getRawMany<{ id: string; priceAmount: string; paid: string }>();
    const total = rows.reduce(
      (s, r) => s + Math.max(0, Number(r.priceAmount) - Number(r.paid)),
      0,
    );
    return { amount: +total.toFixed(2), currency: 'USD' };
  }

  /** Total USD por pagar pendiente (Σ providerAmount bruto − Σ amountInUsd pagado). */
  async payableTotalUsd(
    user: AuthenticatedUser,
  ): Promise<{ amount: number; currency: 'USD' }> {
    const qb = this.apRepo
      .createQueryBuilder('ap')
      .innerJoin('ap.order', 'o')
      .leftJoin('ap.payments', 'p')
      .where('ap.status IN (:...statuses)', {
        statuses: ['unpaid', 'partially_paid'],
      })
      .andWhere('ap."deletedAt" IS NULL')
      .andWhere('o."deletedAt" IS NULL')
      .andWhere('ap."providerAmount" IS NOT NULL');
    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('o."branchId" IN (:...allowed)', { allowed });
    }
    const rows = await qb
      .select('ap.id', 'id')
      .addSelect('ap."providerAmount"', 'providerAmount')
      .addSelect('COALESCE(SUM(p."amountInUsd"), 0)', 'paid')
      .groupBy('ap.id')
      .addGroupBy('ap."providerAmount"')
      .getRawMany<{
        id: string;
        providerAmount: string;
        paid: string;
      }>();
    // Pending USD = bruto providerAmount − pagado. La retención SENIAT se
    // aplica al lote al registrar el pago (taxes_payable), no por AP, así que
    // el target del dashboard es el bruto.
    const total = rows.reduce((s, r) => {
      const provider = Number(r.providerAmount);
      const paid = Number(r.paid);
      return s + Math.max(0, provider - paid);
    }, 0);
    return { amount: +total.toFixed(2), currency: 'USD' };
  }

  /**
   * Total Bs por pagar de retenciones SENIAT (Σ taxAmountBs − Σ amountInBs
   * pagado). Las retenciones se declaran y pagan en Bs (SENIAT), por lo que el
   * dashboard las muestra en su moneda nativa, sin convertir a USD.
   */
  async taxesPayableTotalBs(): Promise<{ amount: number; currency: 'BS' }> {
    const rows = await this.tpRepo
      .createQueryBuilder('tp')
      .leftJoin('tp.payments', 'p')
      .where('tp.status IN (:...statuses)', {
        statuses: ['unpaid', 'partially_paid'],
      })
      .andWhere('tp."deletedAt" IS NULL')
      .select('tp.id', 'id')
      .addSelect('tp."taxAmountBs"', 'taxAmountBs')
      .addSelect('COALESCE(SUM(p."amountInBs"), 0)', 'paidBs')
      .groupBy('tp.id')
      .addGroupBy('tp."taxAmountBs"')
      .getRawMany<{ id: string; taxAmountBs: string; paidBs: string }>();
    const totalBs = rows.reduce(
      (s, r) => s + Math.max(0, Number(r.taxAmountBs) - Number(r.paidBs)),
      0,
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
