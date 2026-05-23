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
import { Order } from '../orders/entities/order.entity';
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

const TOLERANCE_BS = 0.01;

@Injectable()
export class TaxesPayableService {
  constructor(
    @InjectRepository(TaxPayable)
    private readonly repo: Repository<TaxPayable>,
    @InjectRepository(TaxPayablePayment)
    private readonly paymentsRepo: Repository<TaxPayablePayment>,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
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
      .leftJoinAndSelect('tp.order', 'order')
      .leftJoinAndSelect('order.branch', 'branch')
      .leftJoinAndSelect('order.billingExchangeRate', 'billingRate')
      .leftJoinAndSelect('tp.accountsPayable', 'ap')
      .leftJoinAndSelect('tp.doctor', 'doctor')
      .leftJoinAndSelect('tp.careCenter', 'careCenter')
      .leftJoinAndSelect('tp.payments', 'payments')
      .leftJoinAndSelect('payments.exchangeRate', 'paymentRate');

    if (sortBy === 'orderNumber') {
      qb.orderBy('order.orderNumber', sortDir);
    } else {
      qb.orderBy(`tp.${sortBy}`, sortDir);
    }

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('order.branchId IN (:...allowed)', { allowed });
    }

    if (status) qb.andWhere('tp.status = :status', { status });
    if (doctorId) qb.andWhere('tp.doctorId = :doctorId', { doctorId });
    if (careCenterId) qb.andWhere('tp.careCenterId = :careCenterId', { careCenterId });
    if (branchId) qb.andWhere('order.branchId = :branchId', { branchId });
    if (orderId) qb.andWhere('tp.orderId = :orderId', { orderId });

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(order."orderNumber") LIKE :s OR LOWER(tp."taxPayableNumber") LIKE :s)`,
        { s },
      );
    }

    return paginateBuilder<TaxPayable>(qb, page, limit);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<TaxPayable> {
    const tax = await this.repo.findOne({
      where: { id },
      relations: {
        order: { branch: true, billingExchangeRate: true },
        accountsPayable: true,
        doctor: true,
        careCenter: true,
        payments: { exchangeRate: true },
      },
    });
    if (!tax) throw new NotFoundException('Impuesto por pagar no encontrado');
    await this.assertVisibility(tax, user);
    return tax;
  }

  private async assertVisibility(tax: TaxPayable, user: AuthenticatedUser): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = await this.resolveUserBranchIds(user);
    if (!allowed.includes(tax.order.branchId)) {
      throw new ForbiddenException('No tenés acceso a esta cuenta');
    }
  }

  /**
   * Monto a pagar al fisco en Bs por esta cuenta.
   * = taxAmount × (tasa de facturación si no es BS).
   */
  private async targetBs(tax: TaxPayable, order: Order): Promise<number> {
    if (!tax.taxAmount || !tax.taxAmountCurrency) {
      throw new BadRequestException(
        `Orden ${order.orderNumber}: aún no tiene monto de impuesto definido (Paso 4)`,
      );
    }
    const amount = Number(tax.taxAmount);
    if (tax.taxAmountCurrency === 'BS') return amount;
    if (!order.billingExchangeRateId) {
      throw new BadRequestException(
        `Orden ${order.orderNumber}: tasa de facturación no encontrada`,
      );
    }
    const rate =
      order.billingExchangeRate ??
      (await this.ratesRepo.findOne({ where: { id: order.billingExchangeRateId } }));
    if (!rate) throw new BadRequestException('Tasa de facturación no encontrada');
    return amount * Number(rate.amountBs);
  }

  private async resolvePaymentForSave(
    p: TaxPayablePaymentDto,
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

    let amountInBs = 0;
    if (p.amountCurrency === 'BS') {
      amountInBs = p.amountValue;
    } else {
      if (!p.exchangeRateId) {
        throw new BadRequestException(
          `Pago en ${p.amountCurrency}: exchangeRateId requerido para conversión a Bs`,
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

  async registerPayment(
    dto: RegisterTaxPaymentDto,
    user: AuthenticatedUser,
  ): Promise<TaxPayable[]> {
    const taxes = await this.repo.find({
      where: { id: In(dto.taxPayableIds) },
      relations: {
        order: { branch: true, billingExchangeRate: true },
        accountsPayable: true,
        doctor: true,
        careCenter: true,
        payments: true,
      },
    });
    if (taxes.length !== dto.taxPayableIds.length)
      throw new BadRequestException('Alguna cuenta no existe');

    // Visibilidad
    for (const t of taxes) await this.assertVisibility(t, user);

    // Estado: rechaza solo cuentas ya pagadas.
    if (taxes.some((t) => t.status === 'paid')) {
      throw new BadRequestException('Hay cuentas ya pagadas en la selección');
    }

    // Agrupación: mismo doctor o mismo centro.
    const doctorIds = new Set(taxes.map((t) => t.doctorId).filter(Boolean));
    const careCenterIds = new Set(taxes.map((t) => t.careCenterId).filter(Boolean));
    if (
      doctorIds.size > 1 ||
      careCenterIds.size > 1 ||
      (doctorIds.size > 0 && careCenterIds.size > 0)
    ) {
      throw new BadRequestException(
        'Solo se pueden agrupar cuentas del mismo doctor o centro de atención',
      );
    }

    // Monto target en Bs.
    let totalToReceiveBs = 0;
    for (const t of taxes) {
      totalToReceiveBs += await this.targetBs(t, t.order);
    }
    const existingPaidBs = taxes.reduce(
      (sum, t) =>
        sum +
        (t.payments ?? []).reduce((s, p) => s + (Number(p.amountInBs) || 0), 0),
      0,
    );
    const totalPaymentsBs = await this.computePaymentsTotalBs(dto.payments);
    const newTotalBs = existingPaidBs + totalPaymentsBs;

    if (newTotalBs > totalToReceiveBs + TOLERANCE_BS) {
      throw new BadRequestException(
        `El total de pagos (Bs. ${newTotalBs.toFixed(2)}) excede el monto a pagar (Bs. ${totalToReceiveBs.toFixed(2)})`,
      );
    }

    const isFullyPaid = Math.abs(totalToReceiveBs - newTotalBs) <= TOLERANCE_BS;
    const newStatus: 'paid' | 'partially_paid' = isFullyPaid ? 'paid' : 'partially_paid';

    const ids = await this.dataSource.transaction(async (mgr) => {
      const savedPaymentIds: string[] = [];
      for (const p of dto.payments) {
        const payload = await this.resolvePaymentForSave(p);
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
  ): Promise<number> {
    let total = 0;
    for (const p of payments) {
      if (p.amountCurrency === 'BS') {
        total += p.amountValue;
      } else {
        if (!p.exchangeRateId) {
          throw new BadRequestException(
            `Pago en ${p.amountCurrency}: exchangeRateId requerido`,
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
