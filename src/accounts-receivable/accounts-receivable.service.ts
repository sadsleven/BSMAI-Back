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
import {
  computeAmountInBs,
  computeAmountInUsd,
} from '../shared/utils/payment-conversion';
import { Order } from '../orders/entities/order.entity';

const TOLERANCE_USD = 0.01;
const TOLERANCE_BS = 0.01;

/**
 * Target USD que el comercio espera cobrar por una orden. Para órdenes
 * Cashea descuenta la comisión snapshot (el comercio recibe priceAmount
 * × (1 - casheaCommissionRate)). Resto de tipos esperan priceAmount.
 *
 * No aplica a órdenes con `useFixedRate=true` (esas tienen target en Bs,
 * usar `targetBsForOrder`).
 */
export function targetUsdForOrder(order: Order): number {
  const price = Number(order.priceAmount);
  if (!Number.isFinite(price)) return 0;
  if (order.type === 'cashea' && order.casheaCommissionRate != null) {
    const rate = Number(order.casheaCommissionRate);
    if (Number.isFinite(rate)) return +(price * (1 - rate)).toFixed(2);
  }
  return price;
}

/**
 * Target Bs para órdenes seguro con tasa fija. Devuelve null si la orden no
 * está en modo tasa fija. Se calcula `priceAmount × fixedExchangeRate.amountBs`.
 */
export function targetBsForOrder(order: Order): number | null {
  if (!order.useFixedRate || !order.fixedExchangeRate) return null;
  const price = Number(order.priceAmount);
  const rateBs = Number(order.fixedExchangeRate.amountBs);
  if (!Number.isFinite(price) || !Number.isFinite(rateBs)) return null;
  return +(price * rateBs).toFixed(2);
}

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
  ) {
    void this.paymentsRepo;
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
      holderId,
      debtorType,
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
      .leftJoinAndSelect('order.fixedExchangeRate', 'fixedRate')
      .leftJoinAndSelect('ar.insurance', 'insurance')
      .leftJoinAndSelect('ar.holder', 'holder')
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
    if (holderId) qb.andWhere('ar.holderId = :holderId', { holderId });
    if (debtorType === 'insurance') qb.andWhere('ar.insuranceId IS NOT NULL');
    if (debtorType === 'holder') qb.andWhere('ar.holderId IS NOT NULL');
    if (branchId) qb.andWhere('order.branchId = :branchId', { branchId });
    if (orderId) qb.andWhere('ar.orderId = :orderId', { orderId });

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER("order"."orderNumber") LIKE :s
          OR LOWER(ar."receivableNumber") LIKE :s
          OR LOWER(COALESCE(insurance."name", '')) LIKE :s
          OR LOWER(COALESCE(holder."firstName", '')) LIKE :s
          OR LOWER(COALESCE(holder."lastName", '')) LIKE :s
          OR LOWER(COALESCE(holder."businessName", '')) LIKE :s
          OR LOWER(COALESCE(holder."cedula", '')) LIKE :s
          OR LOWER(COALESCE(holder."rif", '')) LIKE :s)`,
        { s },
      );
    }

    return paginateBuilder<AccountsReceivable>(qb, page, limit);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<AccountsReceivable> {
    const account = await this.repo.findOne({
      where: { id },
      relations: {
        order: {
          branch: true,
          billingExchangeRate: true,
          fixedExchangeRate: true,
        },
        insurance: true,
        holder: { phones: true },
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
    usdExchangeRateId?: string | null,
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
      amountInUsd: '0',
    };

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
        throw new BadRequestException('Cobro en BS requiere tasa USD/Bs');
      out.bankCode = p.bankCode;
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'cash_bs') {
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS') throw new BadRequestException('cash_bs debe ser en BS');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('cash_bs requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'cash_usd') {
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('cash_usd debe ser en USD');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_eur') {
      if (p.amountCurrency !== 'EUR')
        throw new BadRequestException('cash_eur debe ser en EUR');
      if (!p.exchangeRateId)
        throw new BadRequestException('exchangeRateId requerido (EUR)');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'EUR')
        throw new BadRequestException('cash_eur requiere una tasa de cambio en EUR');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'other') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('other: amountCurrency debe ser USD');
      out.accountNumber = p.accountNumber ?? null;
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
    // Bs snapshot — usado para AR de seguro con tasa fija. Tomamos la tasa del
    // propio pago: BS=valor crudo, USD/EUR=valor × rate.amountBs del rate snapshot.
    const bsAmount = await computeAmountInBs(conversionInput, this.ratesRepo, {
      usdExchangeRateId: usdExchangeRateId ?? null,
    });
    out.amountInBs = bsAmount.toFixed(2);
    return out;
  }

  async registerCollection(
    dto: RegisterCollectionDto,
    user: AuthenticatedUser,
  ): Promise<AccountsReceivable[]> {
    const accounts = await this.repo.find({
      where: { id: In(dto.receivableIds) },
      relations: {
        order: {
          branch: true,
          billingExchangeRate: true,
          fixedExchangeRate: true,
        },
        insurance: true,
        holder: true,
        payments: true,
      },
    });
    if (accounts.length !== dto.receivableIds.length)
      throw new BadRequestException('Alguna cuenta no existe');

    for (const acc of accounts) await this.assertVisibility(acc, user);

    // Receivable permite cualquier estado: incluso ya 'collected' u 'overcollected'
    // sigue admitiendo más cobros (se acumula como 'overcollected').

    // Agrupación: todas las cuentas deben compartir deudor — mismo seguro o mismo titular.
    // No se permite mezclar tipos de deudor en un mismo cobro.
    const insuranceIds = new Set(
      accounts.filter((a) => a.insuranceId).map((a) => a.insuranceId!),
    );
    const holderIds = new Set(
      accounts.filter((a) => a.holderId).map((a) => a.holderId!),
    );
    if (insuranceIds.size > 0 && holderIds.size > 0) {
      throw new BadRequestException(
        'No se pueden mezclar cuentas de seguro con cuentas de titular',
      );
    }
    if (insuranceIds.size > 1) {
      throw new BadRequestException('Solo se pueden agrupar cuentas del mismo seguro');
    }
    if (holderIds.size > 1) {
      throw new BadRequestException('Solo se pueden agrupar cuentas del mismo titular');
    }

    // Tasa fija: todas las cuentas del cobro deben compartir modo (todo Bs ó
    // todo USD). Mezclar implica monedas distintas — no se puede sumar.
    const fixedRateAccounts = accounts.filter((a) => a.order.useFixedRate);
    const usdRateAccounts = accounts.filter((a) => !a.order.useFixedRate);
    if (fixedRateAccounts.length > 0 && usdRateAccounts.length > 0) {
      throw new BadRequestException(
        'No se pueden mezclar cuentas con tasa fija (Bs) y cuentas en USD en un mismo cobro',
      );
    }
    const useFixedRateMode = fixedRateAccounts.length > 0;

    const usdRateId = accounts[0]?.order?.billingExchangeRateId ?? null;

    let newStatus: 'collected' | 'partially_collected' | 'overcollected';

    if (useFixedRateMode) {
      // Modo Bs: target y cobros se comparan en bolívares.
      let totalTargetBs = 0;
      for (const acc of accounts) {
        const t = targetBsForOrder(acc.order);
        if (t === null)
          throw new BadRequestException(
            'Cuenta con tasa fija sin tasa snapshot — recargá la orden',
          );
        totalTargetBs += t;
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
      const totalNewBs = await this.computePaymentsTotalBs(dto.payments, usdRateId);
      const newTotalBs = existingCollectedBs + totalNewBs;
      if (newTotalBs > totalTargetBs + TOLERANCE_BS) newStatus = 'overcollected';
      else if (Math.abs(totalTargetBs - newTotalBs) <= TOLERANCE_BS)
        newStatus = 'collected';
      else newStatus = 'partially_collected';
    } else {
      // Modo USD: comportamiento histórico, con ajuste Cashea via targetUsdForOrder.
      let totalTargetUsd = 0;
      for (const acc of accounts) {
        totalTargetUsd += targetUsdForOrder(acc.order);
      }
      const existingCollectedUsd = accounts.reduce(
        (sum, acc) =>
          sum +
          (acc.payments ?? []).reduce(
            (s, p) => s + (Number(p.amountInUsd) || 0),
            0,
          ),
        0,
      );
      const totalNewUsd = await this.computePaymentsTotalUsd(dto.payments, usdRateId);
      const newTotalUsd = existingCollectedUsd + totalNewUsd;
      if (newTotalUsd > totalTargetUsd + TOLERANCE_USD) newStatus = 'overcollected';
      else if (Math.abs(totalTargetUsd - newTotalUsd) <= TOLERANCE_USD)
        newStatus = 'collected';
      else newStatus = 'partially_collected';
    }

    const ids = await this.dataSource.transaction(async (mgr) => {
      const savedPaymentIds: string[] = [];
      for (const p of dto.payments) {
        const payload = await this.resolvePaymentForSave(p, usdRateId);
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

  /** Suma los pagos del DTO en Bs via helper. */
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
    return total;
  }

  /** Suma los pagos del DTO en USD via helper. */
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
    return total;
  }
}
