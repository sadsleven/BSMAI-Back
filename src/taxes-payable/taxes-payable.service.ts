import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { TaxPayable } from './entities/tax-payable.entity';
import { TaxPayablePayment } from './entities/tax-payable-payment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import {
  QueryTaxesPayableDto,
  RegisterTaxPaymentDto,
  TaxPayablePaymentDto,
} from './dto/register-tax-payment.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { computeAmountInBs } from '../shared/utils/payment-conversion';

const TOLERANCE_BS = 0.01;

@Injectable()
export class TaxesPayableService {
  constructor(
    @InjectRepository(TaxPayable)
    private readonly repo: Repository<TaxPayable>,
    @InjectRepository(TaxPayablePayment)
    private readonly paymentsRepo: Repository<TaxPayablePayment>,
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
    query: QueryTaxesPayableDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<TaxPayable>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      doctorId,
      careCenterId,
      branchId,
      orderId,
      sortBy = 'createdAt',
      sortDir = 'DESC',
    } = query;

    const qb = this.repo
      .createQueryBuilder('tp')
      .leftJoinAndSelect('tp.taxUnit', 'taxUnit')
      .leftJoinAndSelect('tp.doctor', 'doctor')
      .leftJoinAndSelect('tp.careCenter', 'careCenter')
      .leftJoinAndSelect('tp.orders', 'orders')
      .leftJoinAndSelect('orders.branch', 'branch')
      .leftJoinAndSelect('tp.accountsPayables', 'ap')
      .leftJoinAndSelect('tp.payments', 'payments')
      .leftJoinAndSelect('payments.exchangeRate', 'paymentRate');

    if (sortBy === 'taxPayableNumber') {
      qb.orderBy('tp.taxPayableNumber', sortDir);
    } else {
      qb.orderBy(`tp.${sortBy}`, sortDir);
    }

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('orders.branchId IN (:...allowed)', { allowed });
    }

    if (status) qb.andWhere('tp.status = :status', { status });
    if (doctorId) qb.andWhere('tp.doctorId = :doctorId', { doctorId });
    if (careCenterId) qb.andWhere('tp.careCenterId = :careCenterId', { careCenterId });
    if (branchId) qb.andWhere('orders.branchId = :branchId', { branchId });
    if (orderId) qb.andWhere('orders.id = :orderId', { orderId });

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(orders."orderNumber") LIKE :s OR LOWER(tp."taxPayableNumber") LIKE :s)`,
        { s },
      );
    }

    return paginateBuilder<TaxPayable>(qb, page, limit);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<TaxPayable> {
    const tax = await this.repo.findOne({
      where: { id },
      relations: {
        taxUnit: true,
        doctor: true,
        careCenter: true,
        orders: { branch: true, billingExchangeRate: true },
        accountsPayables: true,
        payments: { exchangeRate: true },
      },
    });
    if (!tax) throw new NotFoundException('Retención por pagar no encontrada');
    await this.assertVisibility(tax, user);
    return tax;
  }

  private async assertVisibility(tax: TaxPayable, user: AuthenticatedUser): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = new Set(await this.resolveUserBranchIds(user));
    const branchIds = (tax.orders ?? []).map((o) => o.branchId).filter(Boolean);
    if (branchIds.length === 0 || branchIds.some((b) => !allowed.has(b))) {
      throw new ForbiddenException('No tenés acceso a este impuesto por pagar');
    }
  }

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
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException('Pago móvil/transferencia debe ser en BS');
      const bank = await this.banksRepo.findOne({ where: { code: p.bankCode } });
      if (!bank) throw new BadRequestException('Banco no encontrado');
      out.bankCode = p.bankCode;
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_bs') {
      if (p.amountCurrency !== 'BS') throw new BadRequestException('cash_bs debe ser en BS');
      out.exchangeRateId = p.exchangeRateId ?? null;
    } else if (p.type === 'cash_usd') {
      if (p.amountCurrency !== 'USD') throw new BadRequestException('cash_usd debe ser en USD');
      if (!p.exchangeRateId)
        throw new BadRequestException('cash_usd requiere tasa USD/Bs (para convertir a Bs)');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'USD')
        throw new BadRequestException('cash_usd requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'cash_eur') {
      if (p.amountCurrency !== 'EUR') throw new BadRequestException('cash_eur debe ser en EUR');
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido (EUR)');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate || rate.currency !== 'EUR')
        throw new BadRequestException('cash_eur requiere una tasa de cambio en EUR');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'other') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      out.accountNumber = p.accountNumber ?? null;
      if (p.amountCurrency !== 'BS' && !p.exchangeRateId) {
        throw new BadRequestException('Pago "other" en USD/EUR requiere exchangeRateId');
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

  async registerPayment(
    dto: RegisterTaxPaymentDto,
    user: AuthenticatedUser,
  ): Promise<TaxPayable[]> {
    const taxes = await this.repo.find({
      where: { id: In(dto.taxPayableIds) },
      relations: {
        taxUnit: true,
        doctor: true,
        careCenter: true,
        orders: { branch: true, billingExchangeRate: true },
        accountsPayables: true,
        payments: true,
      },
    });
    if (taxes.length !== dto.taxPayableIds.length)
      throw new BadRequestException('Alguna cuenta no existe');

    for (const t of taxes) await this.assertVisibility(t, user);

    if (taxes.some((t) => t.status === 'paid')) {
      throw new BadRequestException('Hay cuentas ya pagadas en la selección');
    }

    // Agrupación: mismo proveedor (doctor o centro).
    const doctorIds = new Set(taxes.map((t) => t.doctorId).filter(Boolean));
    const careCenterIds = new Set(taxes.map((t) => t.careCenterId).filter(Boolean));
    if (
      doctorIds.size > 1 ||
      careCenterIds.size > 1 ||
      (doctorIds.size > 0 && careCenterIds.size > 0)
    ) {
      throw new BadRequestException(
        'Solo se pueden agrupar impuestos del mismo doctor o centro de atención',
      );
    }

    // Target en Bs (la retención se entrega al fisco en Bs).
    let totalTargetBs = 0;
    for (const t of taxes) totalTargetBs += Number(t.taxAmountBs);

    const existingPaidBs = taxes.reduce(
      (sum, t) =>
        sum + (t.payments ?? []).reduce((s, p) => s + (Number(p.amountInBs) || 0), 0),
      0,
    );

    const usdRateId = taxes[0]?.orders?.[0]?.billingExchangeRateId ?? null;
    const totalPaymentsBs = await this.computePaymentsTotalBs(dto.payments, usdRateId);
    const newTotalBs = existingPaidBs + totalPaymentsBs;

    if (newTotalBs > totalTargetBs + TOLERANCE_BS) {
      throw new BadRequestException(
        `El total de pagos (Bs ${newTotalBs.toFixed(2)}) excede el monto a pagar al fisco (Bs ${totalTargetBs.toFixed(2)})`,
      );
    }

    const isFullyPaid = Math.abs(totalTargetBs - newTotalBs) <= TOLERANCE_BS;
    const newStatus: 'paid' | 'partially_paid' = isFullyPaid ? 'paid' : 'partially_paid';

    const ids = await this.dataSource.transaction(async (mgr) => {
      const savedPaymentIds: string[] = [];
      for (const p of dto.payments) {
        const payload = await this.resolvePaymentForSave(p, usdRateId);
        const entity = mgr.create(TaxPayablePayment, payload);
        const saved = await mgr.save(entity);
        savedPaymentIds.push(saved.id);
      }
      for (const t of taxes) {
        for (const paymentId of savedPaymentIds) {
          await mgr.query(
            `INSERT INTO "taxes_payable_payment_links" ("taxPayableId", "paymentId")
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [t.id, paymentId],
          );
        }
        await mgr.update(TaxPayable, t.id, {
          status: newStatus,
          paidAt: isFullyPaid ? new Date() : null,
        });
      }
      return taxes.map((t) => t.id);
    });

    return Promise.all(ids.map((id) => this.findOne(id, user)));
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
    return total;
  }
}
