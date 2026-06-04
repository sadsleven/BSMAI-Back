import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AccountsPayable } from './entities/accounts-payable.entity';
import { AccountsPayablePayment } from './entities/accounts-payable-payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { TaxUnitsService } from '../tax-units/tax-units.service';
import {
  AccountsPayablePaymentDto,
  QueryAccountsPayableDto,
  RegisterPaymentDto,
} from './dto/register-payment.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  computeAmountInBs,
  computeAmountInUsd,
  resolveUsdRate,
} from '../shared/utils/payment-conversion';
import {
  calcRetention,
  SeniatPersonType,
} from '../shared/utils/seniat-retention';

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
    private readonly taxUnits: TaxUnitsService,
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

  /**
   * Determina el régimen fiscal del proveedor para el cálculo SENIAT.
   *  - care_center → siempre 'legal_entity' (PJD).
   *  - doctor      → 'legal_entity' si isLegalEntity=true, sino 'natural'.
   */
  private async resolvePersonType(
    recipientType: 'doctor' | 'care_center',
    doctorId: string | null | undefined,
  ): Promise<SeniatPersonType> {
    if (recipientType === 'care_center') return 'legal_entity';
    if (!doctorId) throw new BadRequestException('Doctor faltante en la cuenta por pagar');
    const doctor = await this.doctorsRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new BadRequestException('Doctor no encontrado');
    return doctor.isLegalEntity ? 'legal_entity' : 'natural';
  }

  /**
   * Convierte providerAmount (USD nativo) a Bs vía la tasa de facturación
   * de la orden, o la tasa USD activa más reciente como fallback.
   */
  private async providerGrossBs(account: AccountsPayable, order: Order): Promise<number> {
    if (!account.providerAmount) {
      throw new BadRequestException(
        `Orden ${order.orderNumber}: aún no tiene monto definido para este proveedor (Paso 4)`,
      );
    }
    const amountUsd = Number(account.providerAmount);
    const usdRate = await resolveUsdRate(this.ratesRepo, order.billingExchangeRateId ?? null);
    const usdRateBs = Number(usdRate.amountBs);
    if (!Number.isFinite(usdRateBs) || usdRateBs <= 0) {
      throw new BadRequestException('Tasa USD inválida (amountBs ≤ 0)');
    }
    return Math.round(amountUsd * usdRateBs * 100) / 100;
  }

  private async resolvePaymentForSave(
    p: AccountsPayablePaymentDto,
    usdExchangeRateId?: string | null,
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
        throw new BadRequestException('Pago en BS requiere tasa USD/Bs');
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

    const usdAmount = await computeAmountInUsd(
      {
        amountValue: p.amountValue,
        amountCurrency: p.amountCurrency,
        exchangeRateId: p.exchangeRateId ?? null,
      },
      this.ratesRepo,
      { usdExchangeRateId: usdExchangeRateId ?? null },
    );
    out.amountInUsd = usdAmount.toFixed(2);
    return out;
  }

  /**
   * Registra un pago al proveedor (doctor o centro). Calcula la retención
   * SENIAT sobre el total bruto del lote (en Bs) usando la UT vigente,
   * verifica que la suma de pagos cubra el neto, y genera atómicamente
   * UNA `taxes_payable` que agrupa todas las órdenes y AP cubiertas.
   *
   * El proveedor recibe el monto NETO (= bruto − retención).
   * El monto retenido queda como obligación al fisco en `taxes_payable`.
   */
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

    for (const acc of accounts) await this.assertVisibility(acc, user);

    if (accounts.some((a) => a.status !== 'unpaid')) {
      throw new BadRequestException(
        'Sólo se pueden registrar pagos sobre cuentas con estado "no pagada"',
      );
    }

    // Agrupación obligatoria: mismo proveedor (doctor o centro).
    const doctorIds = new Set(accounts.map((a) => a.doctorId).filter(Boolean));
    const careCenterIds = new Set(accounts.map((a) => a.careCenterId).filter(Boolean));
    if (
      doctorIds.size > 1 ||
      careCenterIds.size > 1 ||
      (doctorIds.size > 0 && careCenterIds.size > 0)
    ) {
      throw new BadRequestException(
        'Solo se pueden agrupar cuentas del mismo doctor o centro de atención',
      );
    }

    const recipientType = accounts[0].recipientType;
    const doctorId = accounts[0].doctorId ?? null;
    const careCenterId = accounts[0].careCenterId ?? null;

    // Régimen fiscal + UT vigente.
    const personType = await this.resolvePersonType(recipientType, doctorId);
    const taxUnit = await this.taxUnits.getCurrentOrThrow();
    const taxUnitAmountBs = Number(taxUnit.amountBs);

    // Bruto Bs (suma providerAmount × tasa USD).
    let totalGrossBs = 0;
    for (const acc of accounts) {
      totalGrossBs += await this.providerGrossBs(acc, acc.order);
    }
    totalGrossBs = Math.round(totalGrossBs * 100) / 100;

    // Retención SENIAT sobre el bruto del lote.
    const retention = calcRetention({
      grossBs: totalGrossBs,
      personType,
      taxUnitBs: taxUnitAmountBs,
    });
    const netToReceiveBs = Math.round((totalGrossBs - retention.taxAmountBs) * 100) / 100;

    // Total pagos Bs entregados al proveedor.
    const usdRateId = accounts[0]?.order?.billingExchangeRateId ?? null;
    const totalPaymentsBs = await this.computePaymentsTotalBs(dto.payments, usdRateId);

    if (Math.abs(totalPaymentsBs - netToReceiveBs) > TOLERANCE_BS) {
      throw new BadRequestException(
        `El total de pagos al proveedor (Bs ${totalPaymentsBs.toFixed(2)}) no coincide con el monto neto a entregar (Bs ${netToReceiveBs.toFixed(2)} = bruto ${totalGrossBs.toFixed(2)} − retención ${retention.taxAmountBs.toFixed(2)})`,
      );
    }

    const ids = await this.dataSource.transaction(async (mgr) => {
      // 1) Persistir pagos al proveedor + linkear a las AP cubiertas.
      const savedPaymentIds: string[] = [];
      for (const p of dto.payments) {
        const payload = await this.resolvePaymentForSave(p, usdRateId);
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
        await mgr.update(AccountsPayable, acc.id, {
          status: 'paid',
          paidAt: new Date(),
        });
      }

      // 2) Crear taxes_payable agrupada.
      const seqRows = await mgr.query<{ nextval: string }[]>(
        `SELECT nextval('taxes_payable_seq') AS nextval`,
      );
      const taxPayableNumber = String(seqRows[0].nextval);
      const insertedTax = await mgr.query<{ id: string }[]>(
        `INSERT INTO "taxes_payable" (
          "taxPayableNumber", "recipientType", "doctorId", "careCenterId",
          "personType", "taxUnitId", "taxUnitAmountBs",
          "grossAmountBs", "taxRate", "subtrahendBs", "taxAmountBs", "status"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'unpaid')
        RETURNING "id"`,
        [
          taxPayableNumber,
          recipientType,
          doctorId,
          careCenterId,
          personType,
          taxUnit.id,
          taxUnitAmountBs.toFixed(2),
          totalGrossBs.toFixed(2),
          retention.taxRate.toFixed(4),
          retention.subtrahendBs.toFixed(2),
          retention.taxAmountBs.toFixed(2),
        ],
      );
      const taxId = insertedTax[0].id;

      // 3) Pivots: órdenes contenidas + AP cubiertas.
      const orderIds = Array.from(new Set(accounts.map((a) => a.orderId)));
      for (const orderId of orderIds) {
        await mgr.query(
          `INSERT INTO "taxes_payable_orders" ("taxPayableId", "orderId")
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [taxId, orderId],
        );
      }
      for (const acc of accounts) {
        await mgr.query(
          `INSERT INTO "taxes_payable_payables" ("taxPayableId", "payableId")
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [taxId, acc.id],
        );
      }

      return accounts.map((a) => a.id);
    });

    return Promise.all(ids.map((id) => this.findOne(id, user)));
  }

  private async computePaymentsTotalBs(
    payments: AccountsPayablePaymentDto[],
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
    return Math.round(total * 100) / 100;
  }
}

