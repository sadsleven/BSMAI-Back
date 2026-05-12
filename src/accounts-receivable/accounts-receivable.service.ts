import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AccountsReceivable } from './entities/accounts-receivable.entity';
import { AccountsReceivablePayment } from './entities/accounts-receivable-payment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import {
  AccountsReceivablePaymentDto,
  QueryAccountsReceivableDto,
  RegisterCollectionDto,
} from './dto/register-collection.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

const TOLERANCE_BS = 0.01;

@Injectable()
export class AccountsReceivableService {
  constructor(
    @InjectRepository(AccountsReceivable)
    private readonly repo: Repository<AccountsReceivable>,
    @InjectRepository(AccountsReceivablePayment)
    private readonly paymentsRepo: Repository<AccountsReceivablePayment>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(ExchangeRate) private readonly ratesRepo: Repository<ExchangeRate>,
    private readonly dataSource: DataSource,
  ) {}

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

  async findAll(
    query: QueryAccountsReceivableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<AccountsReceivable>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      insuranceId,
      branchId,
      orderId,
      sortBy = 'createdAt',
      sortDir = 'DESC',
    } = query;

    const qb = this.repo
      .createQueryBuilder('ar')
      .leftJoinAndSelect('ar.order', 'order')
      .leftJoinAndSelect('order.branch', 'branch')
      .leftJoinAndSelect('order.billingExchangeRate', 'billingRate')
      .leftJoinAndSelect('ar.insurance', 'insurance')
      .leftJoinAndSelect('ar.payments', 'payments')
      .leftJoinAndSelect('payments.exchangeRate', 'paymentRate');

    if (sortBy === 'orderNumber') qb.orderBy('order.orderNumber', sortDir);
    else qb.orderBy(`ar.${sortBy}`, sortDir);

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('order.branchId IN (:...allowed)', { allowed });
    }
    if (status) qb.andWhere('ar.status = :status', { status });
    if (insuranceId) qb.andWhere('ar.insuranceId = :insuranceId', { insuranceId });
    if (branchId) qb.andWhere('order.branchId = :branchId', { branchId });
    if (orderId) qb.andWhere('ar.orderId = :orderId', { orderId });

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(`LOWER(order."orderNumber") LIKE :s`, { s });
    }

    return paginateBuilder<AccountsReceivable>(qb, page, limit);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<AccountsReceivable> {
    const account = await this.repo.findOne({
      where: { id },
      relations: {
        order: { branch: true, billingExchangeRate: true },
        insurance: true,
        payments: { exchangeRate: true },
      },
    });
    if (!account) throw new NotFoundException('Cuenta por cobrar no encontrada');
    await this.assertVisibility(account, user);
    return account;
  }

  private async assertVisibility(
    account: AccountsReceivable,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = await this.resolveUserBranchIds(user);
    if (!allowed.includes(account.order.branchId)) {
      throw new ForbiddenException('No tenés acceso a esta cuenta');
    }
  }

  private async resolvePaymentForSave(
    p: AccountsReceivablePaymentDto,
  ): Promise<Partial<AccountsReceivablePayment>> {
    const out: Partial<AccountsReceivablePayment> = {
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

    let amountInBs = 0;
    if (p.amountCurrency === 'BS') {
      amountInBs = p.amountValue;
    } else {
      if (!p.exchangeRateId) {
        throw new BadRequestException(
          `Cobro en ${p.amountCurrency}: exchangeRateId requerido`,
        );
      }
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      amountInBs = p.amountValue * Number(rate.amountBs);
    }
    out.amountInBs = amountInBs.toFixed(2);

    if (p.type === 'mobile_payment' || p.type === 'bank_transfer') {
      if (!p.bankCode) throw new BadRequestException('bankCode requerido');
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      const bank = await this.banksRepo.findOne({ where: { code: p.bankCode } });
      if (!bank) throw new BadRequestException('Banco no encontrado');
      out.bankCode = p.bankCode;
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_bs') {
      if (p.amountCurrency !== 'BS') throw new BadRequestException('cash_bs debe ser en BS');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_foreign') {
      if (p.amountCurrency === 'BS')
        throw new BadRequestException('cash_foreign no puede ser BS');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'other') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      out.accountNumber = p.accountNumber ?? null;
      out.exchangeRateId = p.exchangeRateId ?? null;
    }
    return out;
  }

  async registerCollection(
    dto: RegisterCollectionDto,
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable[]> {
    const accounts = await this.repo.find({
      where: { id: In(dto.receivableIds) },
      relations: {
        order: { branch: true, billingExchangeRate: true },
        insurance: true,
        payments: true,
      },
    });
    if (accounts.length !== dto.receivableIds.length)
      throw new BadRequestException('Alguna cuenta no existe');

    for (const acc of accounts) await this.assertVisibility(acc, user);

    // Receivable permite cualquier estado: incluso ya 'collected' u 'overcollected'
    // sigue admitiendo más cobros (se acumula como 'overcollected').

    // Agrupación: mismo seguro
    const insuranceIds = new Set(accounts.map((a) => a.insuranceId));
    if (insuranceIds.size > 1) {
      throw new BadRequestException(
        'Solo se pueden agrupar cuentas del mismo seguro',
      );
    }

    // Targets en Bs (priceAmount de cada orden convertido).
    let totalTargetBs = 0;
    for (const acc of accounts) {
      totalTargetBs += await this.priceAmountInBs(acc);
    }

    const existingCollectedBs = accounts.reduce(
      (sum, acc) =>
        sum +
        (acc.payments ?? []).reduce(
          (s, p) => s + (Number(p.amountInBs) || 0),
          0,
        ),
      0,
    );
    const totalNewBs = await this.computePaymentsTotalBs(dto.payments);
    const newTotalBs = existingCollectedBs + totalNewBs;

    // Determinar status (sin cap superior).
    let newStatus: 'collected' | 'partially_collected' | 'overcollected';
    if (newTotalBs > totalTargetBs + TOLERANCE_BS) newStatus = 'overcollected';
    else if (Math.abs(totalTargetBs - newTotalBs) <= TOLERANCE_BS)
      newStatus = 'collected';
    else newStatus = 'partially_collected';

    const ids = await this.dataSource.transaction(async (mgr) => {
      const savedPaymentIds: string[] = [];
      for (const p of dto.payments) {
        const payload = await this.resolvePaymentForSave(p);
        const entity = mgr.create(AccountsReceivablePayment, payload);
        const saved = await mgr.save(entity);
        savedPaymentIds.push(saved.id);
      }
      for (const acc of accounts) {
        for (const paymentId of savedPaymentIds) {
          await mgr.query(
            `INSERT INTO "accounts_receivable_payment_links" ("receivableId", "paymentId")
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [acc.id, paymentId],
          );
        }
        const collectedAt =
          newStatus === 'collected' || newStatus === 'overcollected'
            ? acc.collectedAt ?? new Date()
            : null;
        // update() instead of save() — save() would reconcile M2M and wipe links.
        await mgr.update(AccountsReceivable, acc.id, {
          status: newStatus,
          collectedAt,
        });
      }
      return accounts.map((a) => a.id);
    });

    return Promise.all(ids.map((id) => this.findOne(id, user)));
  }

  /** priceAmount de la orden convertido a Bs vía billingExchangeRate (o tasa actual fallback). */
  private async priceAmountInBs(account: AccountsReceivable): Promise<number> {
    const order = account.order;
    const amount = Number(order.priceAmount);
    if (!order.billingExchangeRateId) {
      // Sin tasa registrada en la orden: usar valor numérico tal cual (interpretado como Bs).
      // En la práctica las cuentas de receivable existen tras facturación → siempre hay billing rate.
      return amount;
    }
    const rate =
      order.billingExchangeRate ??
      (await this.ratesRepo.findOne({ where: { id: order.billingExchangeRateId } }));
    if (!rate) return amount;
    return amount * Number(rate.amountBs);
  }

  /** Suma los pagos del DTO en Bs (BS directo, USD/EUR convertidos vía exchangeRateId). */
  private async computePaymentsTotalBs(
    payments: AccountsReceivablePaymentDto[],
  ): Promise<number> {
    let total = 0;
    for (const p of payments) {
      if (p.amountCurrency === 'BS') {
        total += p.amountValue;
      } else {
        if (!p.exchangeRateId) {
          throw new BadRequestException(
            `Cobro en ${p.amountCurrency}: exchangeRateId requerido`,
          );
        }
        const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
        if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
        total += p.amountValue * Number(rate.amountBs);
      }
    }
    return total;
  }
}
