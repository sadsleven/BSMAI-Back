import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Patient) private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(ExchangeRate) private readonly ratesRepo: Repository<ExchangeRate>,
    private readonly dataSource: DataSource,
  ) {}

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
   * Suma de `(priceAmount × billingRate) − doctorAmount(Bs)` para órdenes finalizadas
   * del mes en curso, dividida por la tasa USD activa.
   * Retorna `amount = null` si no hay tasa USD activa.
   */
  async billedMonthUsd(
    user: AuthenticatedUser,
  ): Promise<{ amount: number | null; currency: 'USD' }> {
    const { from, to } = monthRangeIso();
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.billingExchangeRate', 'billingRate')
      .where('o.status = :st', { st: 'finalized' })
      .andWhere('o.orderDate >= :from', { from })
      .andWhere('o.orderDate <= :to', { to })
      .andWhere('o.deletedAt IS NULL');
    await this.applyBranchScope(qb, user);
    const orders = await qb.getMany();

    const usd = await this.ratesRepo.findOne({
      where: { currency: 'USD', isActive: true, deletedAt: IsNull() },
      order: { effectiveDate: 'DESC' },
    });
    if (!usd) return { amount: null, currency: 'USD' };
    const usdRate = Number(usd.amountBs);
    if (!Number.isFinite(usdRate) || usdRate <= 0) {
      return { amount: null, currency: 'USD' };
    }

    const totalBs = orders.reduce((sum, o) => sum + netProfitBs(o), 0);
    return { amount: totalBs / usdRate, currency: 'USD' };
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

function netProfitBs(o: Order): number {
  const price = Number(o.priceAmount);
  if (!Number.isFinite(price) || price <= 0) return 0;
  const rate = Number(o.billingExchangeRate?.amountBs ?? 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const priceBs = price * rate;
  const docAmount = Number(o.doctorAmount ?? 0);
  if (!Number.isFinite(docAmount) || docAmount <= 0) return priceBs;
  const docBs = o.doctorAmountCurrency === 'BS' ? docAmount : docAmount * rate;
  return priceBs - docBs;
}
