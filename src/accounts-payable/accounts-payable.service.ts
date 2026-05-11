import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AccountsPayable } from './entities/accounts-payable.entity';
import { AccountsPayablePayment } from './entities/accounts-payable-payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import {
  AccountsPayablePaymentDto,
  QueryAccountsPayableDto,
  RegisterPaymentDto,
} from './dto/register-payment.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

const TOLERANCE_BS = 0.01;

@Injectable()
export class AccountsPayableService {
  constructor(
    @InjectRepository(AccountsPayable)
    private readonly repo: Repository<AccountsPayable>,
    @InjectRepository(AccountsPayablePayment)
    private readonly paymentsRepo: Repository<AccountsPayablePayment>,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(ExchangeRate) private readonly ratesRepo: Repository<ExchangeRate>,
    @InjectRepository(Doctor) private readonly doctorsRepo: Repository<Doctor>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  private taxRateFor(isLegalEntity: boolean): number {
    const key = isLegalEntity ? 'DOCTOR_LEGAL_TAX_RATE' : 'DOCTOR_NATURAL_TAX_RATE';
    const fallback = isLegalEntity ? 0.05 : 0.03;
    const raw = this.config.get<string>(key);
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
    return n;
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
      orderId,
      sortBy = 'createdAt',
      sortDir = 'DESC',
    } = query;

    const qb = this.repo
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.order', 'order')
      .leftJoinAndSelect('order.branch', 'branch')
      .leftJoinAndSelect('order.billingExchangeRate', 'billingRate')
      .leftJoinAndSelect('ap.doctor', 'doctor')
      .leftJoinAndSelect('ap.careCenter', 'careCenter')
      .leftJoinAndSelect('ap.payments', 'payments')
      .leftJoinAndSelect('payments.exchangeRate', 'paymentRate');

    if (sortBy === 'orderNumber') {
      qb.orderBy('order.orderNumber', sortDir);
    } else {
      qb.orderBy(`ap.${sortBy}`, sortDir);
    }

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) qb.andWhere('1 = 0');
      else qb.andWhere('order.branchId IN (:...allowed)', { allowed });
    }

    if (status) qb.andWhere('ap.status = :status', { status });
    if (doctorId) qb.andWhere('ap.doctorId = :doctorId', { doctorId });
    if (careCenterId) qb.andWhere('ap.careCenterId = :careCenterId', { careCenterId });
    if (branchId) qb.andWhere('order.branchId = :branchId', { branchId });
    if (orderId) qb.andWhere('ap.orderId = :orderId', { orderId });

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(`LOWER(order."orderNumber") LIKE :s`, { s });
    }

    return paginateBuilder<AccountsPayable>(qb, page, limit);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<AccountsPayable> {
    const account = await this.repo.findOne({
      where: { id },
      relations: {
        order: { branch: true, billingExchangeRate: true },
        doctor: true,
        careCenter: true,
        payments: { exchangeRate: true },
      },
    });
    if (!account) throw new NotFoundException('Cuenta por pagar no encontrada');
    await this.assertVisibility(account, user);
    return account;
  }

  private async assertVisibility(
    account: AccountsPayable,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = await this.resolveUserBranchIds(user);
    if (!allowed.includes(account.order.branchId)) {
      throw new ForbiddenException('No tenés acceso a esta cuenta');
    }
  }

  /** Computa el monto a recibir (en Bs) para una cuenta. */
  private async amountToReceiveBs(
    account: AccountsPayable,
    order: Order,
  ): Promise<number> {
    if (!order.doctorAmount || !order.doctorAmountCurrency) {
      throw new BadRequestException(
        `Orden ${order.orderNumber}: aún no tiene monto al doctor definido (Paso 4)`,
      );
    }
    const amount = Number(order.doctorAmount);
    let amountBs: number;
    if (order.doctorAmountCurrency === 'BS') {
      amountBs = amount;
    } else {
      if (!order.billingExchangeRateId) {
        throw new BadRequestException(
          `Orden ${order.orderNumber}: tasa de facturación no encontrada`,
        );
      }
      const rate =
        order.billingExchangeRate ??
        (await this.ratesRepo.findOne({ where: { id: order.billingExchangeRateId } }));
      if (!rate) throw new BadRequestException('Tasa de facturación no encontrada');
      amountBs = amount * Number(rate.amountBs);
    }

    if (account.recipientType === 'doctor') {
      const doctorId = account.doctorId ?? order.doctorId;
      if (!doctorId) throw new BadRequestException('Doctor no encontrado en cuenta');
      const doctor = await this.doctorsRepo.findOne({ where: { id: doctorId } });
      if (!doctor) throw new BadRequestException('Doctor no encontrado');
      const taxRate = this.taxRateFor(doctor.isLegalEntity);
      return amountBs * (1 - taxRate);
    }
    return amountBs;
  }

  private async resolvePaymentForSave(
    p: AccountsPayablePaymentDto,
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
    dto: RegisterPaymentDto,
    user: AuthenticatedUser,
  ): Promise<AccountsPayable[]> {
    const accounts = await this.repo.find({
      where: { id: In(dto.payableIds) },
      relations: {
        order: { branch: true, billingExchangeRate: true },
        doctor: true,
        careCenter: true,
        payments: true,
      },
    });
    if (accounts.length !== dto.payableIds.length)
      throw new BadRequestException('Alguna cuenta no existe');

    // Visibilidad
    for (const acc of accounts) await this.assertVisibility(acc, user);

    // Estado: rechaza solo cuentas ya pagadas; permite unpaid + partially_paid.
    if (accounts.some((a) => a.status === 'paid')) {
      throw new BadRequestException('Hay cuentas ya pagadas en la selección');
    }

    // Agrupación: mismo doctor o mismo centro
    const doctorIds = new Set(accounts.map((a) => a.doctorId).filter(Boolean));
    const careCenterIds = new Set(accounts.map((a) => a.careCenterId).filter(Boolean));
    if (doctorIds.size > 1 || careCenterIds.size > 1 || (doctorIds.size > 0 && careCenterIds.size > 0)) {
      throw new BadRequestException(
        'Solo se pueden agrupar cuentas del mismo doctor o centro de atención',
      );
    }

    // Monto target en Bs
    let totalToReceiveBs = 0;
    for (const acc of accounts) {
      totalToReceiveBs += await this.amountToReceiveBs(acc, acc.order);
    }
    // Pagos previos ya aplicados (suma en Bs de los linked payments).
    const existingPaidBs = accounts.reduce(
      (sum, acc) =>
        sum +
        (acc.payments ?? []).reduce(
          (s, p) => s + (Number(p.amountInBs) || 0),
          0,
        ),
      0,
    );
    const totalPaymentsBs = await this.computePaymentsTotalBs(dto.payments);
    const newTotalBs = existingPaidBs + totalPaymentsBs;

    // Cap: no permite sobrepagar (payable tiene techo).
    if (newTotalBs > totalToReceiveBs + TOLERANCE_BS) {
      throw new BadRequestException(
        `El total de pagos (Bs. ${newTotalBs.toFixed(2)}) excede el monto a pagar (Bs. ${totalToReceiveBs.toFixed(2)})`,
      );
    }

    // Determinar estado nuevo del grupo: paid si cubre el target con tolerancia, sino partially_paid.
    const isFullyPaid = Math.abs(totalToReceiveBs - newTotalBs) <= TOLERANCE_BS;
    const newStatus: 'paid' | 'partially_paid' = isFullyPaid ? 'paid' : 'partially_paid';

    // Persistir transaccionalmente
    const ids = await this.dataSource.transaction(async (mgr) => {
      const savedPaymentIds: string[] = [];
      for (const p of dto.payments) {
        const payload = await this.resolvePaymentForSave(p);
        const entity = mgr.create(AccountsPayablePayment, payload);
        const saved = await mgr.save(entity);
        savedPaymentIds.push(saved.id);
      }

      for (const acc of accounts) {
        for (const paymentId of savedPaymentIds) {
          await mgr.query(
            `INSERT INTO "accounts_payable_payment_links" ("payableId", "paymentId")
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [acc.id, paymentId],
          );
        }
        acc.status = newStatus;
        acc.paidAt = isFullyPaid ? new Date() : null;
        await mgr.save(acc);
      }
      return accounts.map((a) => a.id);
    });

    return Promise.all(ids.map((id) => this.findOne(id, user)));
  }

  private async computePaymentsTotalBs(
    payments: AccountsPayablePaymentDto[],
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
