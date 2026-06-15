import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { OrderServiceType } from './entities/order-service-type.entity';
import { OrderProviderReport } from './entities/order-provider-report.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderServiceTypeRowDto } from './dto/order-service-type.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { CreateOrderPaymentDto, UpdateOrderPaymentDto } from './dto/order-payment.dto';
import {
  AttendOrderDto,
  AuthorizeOrderAmountDto,
  BillingOrderDto,
  BillingProviderDto,
  ReportOrderDto,
} from './dto/order-stages.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { Pathology } from '../pathologies/entities/pathology.entity';
import { InsuranceServicePrice } from '../insurances/entities/insurance-service-price.entity';
import { DoctorServicePrice } from '../doctors/entities/doctor-service-price.entity';
import { CareCenterServicePrice } from '../care-centers/entities/care-center-service-price.entity';
import { OrderServicePricing } from './entities/order-service-pricing.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthService } from '../auth/auth.service';
import { AppConfigService } from '../app-config/app-config.service';
import { orderReportProviderKind } from '../files/files.constants';
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service';
import {
  ProviderAccountsService,
  ProviderLink,
} from '../provider-accounts/provider-accounts.service';
import {
  computeAmountInUsd,
  resolveUsdRate,
} from '../shared/utils/payment-conversion';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['in_progress', 'cancelled'],
  in_progress: ['attended', 'cancelled'],
  attended: ['report_issued', 'cancelled'],
  report_issued: ['finalized', 'cancelled'],
  finalized: [],
  cancelled: [],
};
void ALLOWED_TRANSITIONS;

type ProviderKey = `doctor:${string}` | `care_center:${string}`;

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly repo: Repository<Order>,
    @InjectRepository(OrderPayment) private readonly paymentsRepo: Repository<OrderPayment>,
    @InjectRepository(OrderServiceType)
    private readonly ostRepo: Repository<OrderServiceType>,
    @InjectRepository(Patient) private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Doctor) private readonly doctorsRepo: Repository<Doctor>,
    @InjectRepository(CareCenter) private readonly careCentersRepo: Repository<CareCenter>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(ExchangeRate) private readonly ratesRepo: Repository<ExchangeRate>,
    @InjectRepository(ServiceType) private readonly serviceTypesRepo: Repository<ServiceType>,
    @InjectRepository(Pathology) private readonly pathologiesRepo: Repository<Pathology>,
    @InjectRepository(InsuranceServicePrice)
    private readonly insurancePricesRepo: Repository<InsuranceServicePrice>,
    @InjectRepository(DoctorServicePrice)
    private readonly doctorPricesRepo: Repository<DoctorServicePrice>,
    @InjectRepository(CareCenterServicePrice)
    private readonly careCenterPricesRepo: Repository<CareCenterServicePrice>,
    @InjectRepository(OrderServicePricing)
    private readonly orderPricingRepo: Repository<OrderServicePricing>,
    @InjectRepository(OrderProviderReport)
    private readonly providerReportsRepo: Repository<OrderProviderReport>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly appConfig: AppConfigService,
    private readonly paymentAccounts: PaymentAccountsService,
    private readonly providerAccounts: ProviderAccountsService,
  ) {
    void this.insurancePricesRepo;
    void this.orderPricingRepo;
    void this.ostRepo;
    void this.banksRepo;
  }

  async onModuleInit(): Promise<void> {
    await this.bumpSequence('orders_seq', 'ORDER_NUMBER_START');
    await this.bumpSequence('accounts_payable_seq', 'PAYABLE_NUMBER_START');
    await this.bumpSequence('accounts_receivable_seq', 'RECEIVABLE_NUMBER_START');
    await this.bumpSequence('taxes_payable_seq', 'TAX_PAYABLE_NUMBER_START');
  }

  private userHasPermission(user: AuthenticatedUser, perm: string): boolean {
    if (user.isSuperAdmin) return true;
    return (user.permissions ?? []).includes(perm);
  }

  /**
   * Suma de precios Particular (USD) de las filas dadas, multiplicando por la
   * cantidad cuando el ST permite cantidad. Usado para forzar el monto cuando el
   * usuario no tiene orders.edit-amount.
   */
  private async computeParticularSum(
    rows: Array<{ serviceTypeId: string; quantity?: number }>,
  ): Promise<number> {
    if (!rows.length) return 0;
    const ids = Array.from(new Set(rows.map((r) => r.serviceTypeId)));
    const sts = await this.serviceTypesRepo.find({
      where: { id: In(ids) },
      select: ['id', 'particularPriceUsd', 'allowsQuantity'],
    });
    const byId = new Map(sts.map((s) => [s.id, s]));
    let sum = 0;
    for (const r of rows) {
      const st = byId.get(r.serviceTypeId);
      if (!st) continue;
      const n = Number(st.particularPriceUsd);
      if (!Number.isFinite(n)) continue;
      const qty = st.allowsQuantity ? Math.max(1, Math.trunc(r.quantity ?? 1)) : 1;
      sum += n * qty;
    }
    return +sum.toFixed(2);
  }

  private async bumpSequence(seq: string, envKey: string): Promise<void> {
    const raw = this.config.get<string>(envKey);
    const start = raw ? Number(raw) : 1;
    if (!Number.isFinite(start) || start <= 1) return;
    try {
      const rows = await this.dataSource.query<
        { last_value: string; is_called: boolean }[]
      >(`SELECT last_value, is_called FROM ${seq}`);
      const lastValue = rows[0] ? Number(rows[0].last_value) : 0;
      const isCalled = rows[0]?.is_called ?? false;
      const nextWouldBe = isCalled ? lastValue + 1 : lastValue;
      if (nextWouldBe >= start) return;
      await this.dataSource.query(`SELECT setval('${seq}', $1, true)`, [start - 1]);
      this.logger.log(`${seq} bumped: próximo número = ${start}`);
    } catch (e) {
      this.logger.warn(
        `No se pudo inicializar ${seq} desde ${envKey}: ${(e as Error).message}`,
      );
    }
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

  private async generateOrderNumber(): Promise<string> {
    const result = await this.dataSource.query<{ nextval: string }[]>(
      "SELECT nextval('orders_seq') AS nextval",
    );
    return String(result[0].nextval);
  }

  private orderRelations() {
    return {
      branch: true,
      holder: { phones: true },
      patient: { phones: true },
      contractor: true,
      insurance: { phones: true },
      specialty: true,
      orderServiceTypes: {
        serviceType: true,
        doctor: true,
        careCenter: true,
      },
      pathologies: true,
      createdBy: true,
      amountAuthorizedBy: true,
      payments: { exchangeRate: true },
      billingExchangeRate: true,
      fixedExchangeRate: true,
      servicePricing: true,
      providerReports: { doctor: true, careCenter: true },
    } as const;
  }

  /** Resuelve el proveedor vinculado al usuario (o null si es staff/super admin). */
  private async resolveProvider(
    user: AuthenticatedUser,
  ): Promise<ProviderLink | null> {
    if (user.isSuperAdmin) return null;
    return this.providerAccounts.findProviderByUserId(user.id);
  }

  /** ¿La orden (cargada con orderServiceTypes) incluye al proveedor dado? */
  private orderHasProvider(order: Order, provider: ProviderLink): boolean {
    return (order.orderServiceTypes ?? []).some((ost) =>
      provider.type === 'doctor'
        ? ost.doctorId === provider.id
        : ost.careCenterId === provider.id,
    );
  }

  async findAll(
    query: QueryOrdersDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponse<Order>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      branchId,
      doctorId,
      careCenterId,
      specialtyId,
      orderDateFrom,
      orderDateTo,
      appointmentDateFrom,
      appointmentDateTo,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
    } = query;

    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.branch', 'branch')
      .leftJoinAndSelect('o.holder', 'holder')
      .leftJoinAndSelect('holder.phones', 'holderPhones')
      .leftJoinAndSelect('o.patient', 'patient')
      .leftJoinAndSelect('patient.phones', 'patientPhones')
      .leftJoinAndSelect('o.specialty', 'specialty')
      .leftJoinAndSelect('o.orderServiceTypes', 'ost')
      .leftJoinAndSelect('ost.serviceType', 'serviceType')
      .leftJoinAndSelect('ost.doctor', 'ostDoctor')
      .leftJoinAndSelect('ost.careCenter', 'ostCareCenter')
      .leftJoinAndSelect('o.pathologies', 'pathology')
      .leftJoinAndSelect('o.contractor', 'contractor')
      .leftJoinAndSelect('o.insurance', 'insurance')
      .leftJoinAndSelect('insurance.phones', 'insurancePhones')
      .orderBy(`o.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('o.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    const provider = user.isSuperAdmin ? null : await this.resolveProvider(user);
    if (!user.isSuperAdmin) {
      if (provider) {
        // Usuario proveedor: solo sus órdenes (vía OST) y solo accionables.
        qb.andWhere(
          provider.type === 'doctor'
            ? 'EXISTS (SELECT 1 FROM order_service_types pst WHERE pst."orderId" = o.id AND pst."doctorId" = :pid)'
            : 'EXISTS (SELECT 1 FROM order_service_types pst WHERE pst."orderId" = o.id AND pst."careCenterId" = :pid)',
          { pid: provider.id },
        );
        qb.andWhere("o.status IN ('attended', 'report_issued', 'finalized')");
      } else {
        const allowed = await this.resolveUserBranchIds(user);
        if (allowed.length === 0) {
          qb.andWhere('1 = 0');
        } else {
          qb.andWhere('o.branchId IN (:...allowed)', { allowed });
        }
      }
    }

    if (branchId) qb.andWhere('o.branchId = :branchId', { branchId });
    if (status) qb.andWhere('o.status = :status', { status });
    if (type) qb.andWhere('o.type = :type', { type });
    // Filtros doctor/care_center ahora vía OST.
    if (doctorId)
      qb.andWhere(
        'EXISTS (SELECT 1 FROM order_service_types fst WHERE fst."orderId" = o.id AND fst."doctorId" = :doctorId)',
        { doctorId },
      );
    if (careCenterId)
      qb.andWhere(
        'EXISTS (SELECT 1 FROM order_service_types fst WHERE fst."orderId" = o.id AND fst."careCenterId" = :careCenterId)',
        { careCenterId },
      );
    if (specialtyId) qb.andWhere('o.specialtyId = :specialtyId', { specialtyId });
    if (orderDateFrom) qb.andWhere('o.orderDate >= :odf', { odf: orderDateFrom });
    if (orderDateTo) qb.andWhere('o.orderDate <= :odt', { odt: orderDateTo });
    if (appointmentDateFrom)
      qb.andWhere('o.appointmentDate >= :adf', { adf: appointmentDateFrom });
    if (appointmentDateTo) qb.andWhere('o.appointmentDate <= :adt', { adt: appointmentDateTo });

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(o."orderNumber") LIKE :s
          OR LOWER(holder."firstName") LIKE :s
          OR LOWER(holder."lastName") LIKE :s
          OR LOWER(holder."businessName") LIKE :s
          OR LOWER(holder.cedula) LIKE :s
          OR LOWER(holder.rif) LIKE :s
          OR LOWER(patient."firstName") LIKE :s
          OR LOWER(patient."lastName") LIKE :s
          OR LOWER(patient."businessName") LIKE :s
          OR LOWER(patient.cedula) LIKE :s
          OR LOWER(patient.rif) LIKE :s)`,
        { s },
      );
    }

    const result = await paginateBuilder<Order>(qb, page, limit);

    // Usuario proveedor: marca si SU propia observación (Paso 3) está completa.
    // Completa = tiene un order_provider_report suyo con observations no vacío
    // O al menos un archivo suyo (kind por proveedor) adjunto a la orden.
    if (provider && result.data.length) {
      const ids = result.data.map((o) => o.id);
      const col = provider.type === 'doctor' ? 'doctorId' : 'careCenterId';
      const kind = orderReportProviderKind(provider.type, provider.id);
      const rows = await this.repo.manager.query<Array<{ orderId: string }>>(
        `SELECT t.id AS "orderId"
           FROM unnest($1::uuid[]) AS t(id)
          WHERE EXISTS (
                  SELECT 1 FROM "order_provider_reports" r
                   WHERE r."orderId" = t.id AND r."${col}" = $2
                     AND r."observations" IS NOT NULL AND btrim(r."observations") <> ''
                )
             OR EXISTS (
                  SELECT 1 FROM "files" f
                   WHERE f."ownerType" = 'order' AND f."ownerId" = t.id
                     AND f."kind" = $3 AND f."deletedAt" IS NULL
                )`,
        [ids, provider.id, kind],
      );
      const done = new Set(rows.map((r) => r.orderId));
      for (const o of result.data) o.providerObservationComplete = done.has(o.id);
    }

    return result;
  }

  async findOne(id: string, user: AuthenticatedUser, withDeleted = false): Promise<Order> {
    const order = await this.repo.findOne({
      where: { id },
      relations: this.orderRelations(),
      withDeleted,
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    await this.assertOrderVisibility(order, user);
    return order;
  }

  /**
   * Visibilidad de una orden ya cargada (con `orderServiceTypes`).
   *  - Super Admin: siempre.
   *  - Usuario proveedor: solo si participa en la orden (vía OST).
   *  - Staff: por sucursal asignada.
   */
  private async assertOrderVisibility(
    order: Order,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (user.isSuperAdmin) return;
    const provider = await this.resolveProvider(user);
    if (provider) {
      if (!this.orderHasProvider(order, provider)) {
        throw new ForbiddenException('No tenés acceso a esta orden');
      }
      return;
    }
    await this.assertBranchVisibility(order.branchId, user);
  }

  private async assertBranchVisibility(branchId: string, user: AuthenticatedUser): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = await this.resolveUserBranchIds(user);
    if (!allowed.includes(branchId)) {
      throw new ForbiddenException('No tenés acceso a esta sucursal');
    }
  }

  /**
   * Valida referencias core. Provider validation per ST row: cada fila debe
   * tener exactamente uno de doctorId/careCenterId coherente con providerType,
   * y el proveedor debe tener la especialidad de la orden.
   */
  private async validateCoreReferences(
    dto: Partial<CreateOrderDto>,
    user: AuthenticatedUser,
  ): Promise<{ holder: Patient }> {
    if (!dto.branchId) throw new BadRequestException('branchId requerido');
    await this.assertBranchVisibility(dto.branchId, user);

    if (!dto.specialtyId) throw new BadRequestException('specialtyId requerido');

    const holder = await this.patientsRepo.findOne({
      where: { id: dto.holderId!, deletedAt: IsNull() },
      relations: { contractors: { insurances: true }, insurances: true },
    });
    if (!holder) throw new BadRequestException('Titular no encontrado o eliminado');

    if (dto.patientId && dto.patientId !== dto.holderId) {
      const pat = await this.patientsRepo.findOne({
        where: { id: dto.patientId, deletedAt: IsNull() },
      });
      if (!pat) throw new BadRequestException('Paciente no encontrado o eliminado');
    }

    if (dto.type === 'insurance') {
      if (!dto.insuranceId)
        throw new BadRequestException('Tipo seguro: insuranceId requerido');
      if (!dto.insuranceSource)
        throw new BadRequestException(
          'Tipo seguro: insuranceSource requerido (direct | via_contractor)',
        );

      if (dto.insuranceSource === 'via_contractor') {
        if (!dto.contractorId)
          throw new BadRequestException(
            'insuranceSource=via_contractor requiere contractorId',
          );
        const contractor = (holder.contractors ?? []).find(
          (c) => c.id === dto.contractorId,
        );
        if (!contractor)
          throw new BadRequestException('Contratista no asignado al titular');
        const okInsurance = (contractor.insurances ?? []).some(
          (i) => i.id === dto.insuranceId,
        );
        if (!okInsurance)
          throw new BadRequestException(
            'Seguro no asociado al contratista del titular',
          );
      } else {
        if (dto.contractorId)
          throw new BadRequestException(
            'insuranceSource=direct no admite contractorId',
          );
        const okDirect = (holder.insurances ?? []).some(
          (i) => i.id === dto.insuranceId,
        );
        if (!okDirect)
          throw new BadRequestException(
            'Seguro no asignado directamente al titular',
          );
      }
    } else if (dto.contractorId || dto.insuranceId || dto.insuranceSource) {
      throw new BadRequestException(
        'contractorId/insuranceId/insuranceSource solo válidos para tipo seguro',
      );
    }

    if (dto.type !== 'insurance' && dto.serviceKey && dto.serviceKey.trim() !== '') {
      throw new BadRequestException(
        'serviceKey solo aplica para órdenes tipo seguro',
      );
    }

    // Validar tasa fija — sólo en órdenes seguro y siempre acompañada de la tasa.
    if (dto.useFixedRate) {
      if (dto.type !== 'insurance') {
        throw new BadRequestException(
          'La tasa fija solo aplica para órdenes tipo seguro',
        );
      }
      if (!dto.fixedExchangeRateId) {
        throw new BadRequestException(
          'Tasa fija activada requiere fixedExchangeRateId',
        );
      }
      const rate = await this.ratesRepo.findOne({
        where: { id: dto.fixedExchangeRateId },
      });
      if (!rate) throw new BadRequestException('Tasa fija no encontrada');
      if (rate.currency !== 'USD') {
        throw new BadRequestException('La tasa fija debe ser USD/Bs');
      }
    } else if (dto.fixedExchangeRateId) {
      throw new BadRequestException(
        'fixedExchangeRateId solo se admite cuando useFixedRate=true',
      );
    }

    if (dto.orderDate && dto.appointmentDate) {
      if (new Date(dto.appointmentDate) < new Date(dto.orderDate))
        throw new BadRequestException('appointmentDate debe ser ≥ orderDate');
    }

    const rows = dto.serviceTypes ?? [];
    if (!rows.length) {
      throw new BadRequestException('Asigná al menos un tipo de servicio');
    }
    const stIds = rows.map((r) => r.serviceTypeId);
    if (new Set(stIds).size !== stIds.length) {
      throw new BadRequestException(
        'Hay tipos de servicio duplicados — cada ST debe aparecer una sola vez',
      );
    }
    const sts = await this.serviceTypesRepo.find({
      where: { id: In(stIds), deletedAt: IsNull() },
      select: ['id', 'isActive'],
    });
    if (sts.length !== stIds.length || sts.some((s) => !s.isActive)) {
      throw new BadRequestException(
        'Algún tipo de servicio no existe o está deshabilitado',
      );
    }

    // Validate provider per row.
    const doctorIds = Array.from(
      new Set(rows.filter((r) => r.providerType === 'doctor').map((r) => r.doctorId!)),
    );
    const ccIds = Array.from(
      new Set(rows.filter((r) => r.providerType === 'care_center').map((r) => r.careCenterId!)),
    );
    const doctors = doctorIds.length
      ? await this.doctorsRepo.find({
          where: { id: In(doctorIds), deletedAt: IsNull() },
          relations: { specialties: true },
        })
      : [];
    const ccs = ccIds.length
      ? await this.careCentersRepo.find({
          where: { id: In(ccIds), deletedAt: IsNull() },
          relations: { specialties: true },
        })
      : [];
    const docMap = new Map(doctors.map((d) => [d.id, d]));
    const ccMap = new Map(ccs.map((c) => [c.id, c]));

    for (const row of rows) {
      if (row.providerType === 'doctor') {
        if (!row.doctorId) {
          throw new BadRequestException(
            'Cada fila Doctor requiere doctorId',
          );
        }
        if (row.careCenterId) {
          throw new BadRequestException(
            'Fila Doctor no admite careCenterId',
          );
        }
        const d = docMap.get(row.doctorId);
        if (!d || !d.isActive)
          throw new BadRequestException(
            `Doctor de un tipo de servicio no encontrado o deshabilitado`,
          );
      } else {
        if (!row.careCenterId) {
          throw new BadRequestException(
            'Cada fila Centro requiere careCenterId',
          );
        }
        if (row.doctorId) {
          throw new BadRequestException(
            'Fila Centro no admite doctorId',
          );
        }
        const cc = ccMap.get(row.careCenterId);
        if (!cc || !cc.isActive)
          throw new BadRequestException(
            `Centro de un tipo de servicio no encontrado o deshabilitado`,
          );
      }
    }

    if (dto.pathologyIds && dto.pathologyIds.length) {
      const pIds = Array.from(new Set(dto.pathologyIds));
      const ps = await this.pathologiesRepo.find({
        where: { id: In(pIds), deletedAt: IsNull() },
        select: ['id', 'isActive'],
      });
      if (ps.length !== pIds.length || ps.some((p) => !p.isActive)) {
        throw new BadRequestException('Alguna patología no existe o está deshabilitada');
      }
    }

    return { holder };
  }

  /**
   * Normaliza un pago para guardar. Valida método→moneda y deriva
   * `amountInUsd` con el helper compartido. Si `usdExchangeRateId` viene
   * (ej. la orden ya tiene `billingExchangeRateId`), se usa como ref USD/Bs;
   * sino, se toma la última USD activa.
   */
  private async resolvePaymentForSave(
    p: CreateOrderPaymentDto,
    usdExchangeRateId?: string | null,
  ): Promise<Partial<OrderPayment>> {
    const out: Partial<OrderPayment> = {
      type: p.type,
      paymentDate: p.paymentDate,
      referenceNumber: p.referenceNumber ?? null,
      bankCode: null,
      accountNumber: null,
      exchangeRateId: null,
      paymentAccountId: null,
      amountCurrency: p.amountCurrency,
      amountValue: p.amountValue.toFixed(2),
      amountInUsd: '0',
    };

    const needsPaymentAccount =
      p.type === 'mobile_payment' ||
      p.type === 'bank_transfer' ||
      p.type === 'bank_transfer_usd' ||
      p.type === 'card' ||
      p.type === 'other';

    if (needsPaymentAccount) {
      if (!p.paymentAccountId)
        throw new BadRequestException(
          `paymentAccountId requerido para pagos de tipo ${p.type}`,
        );
      const account = await this.paymentAccounts.assertUsableForPaymentType(
        p.paymentAccountId,
        p.type as
          | 'mobile_payment'
          | 'bank_transfer'
          | 'bank_transfer_usd'
          | 'card'
          | 'other',
      );
      out.paymentAccountId = account.id;
      // Snapshot desde la cuenta para histórico — independiente de cambios futuros.
      out.bankCode = account.bankCode ?? null;
      out.accountNumber = account.accountNumber ?? null;
    } else if (p.paymentAccountId) {
      throw new BadRequestException(
        `Pagos de tipo ${p.type} no pueden referenciar una cuenta de pago`,
      );
    }

    if (
      p.type === 'mobile_payment' ||
      p.type === 'bank_transfer' ||
      p.type === 'card'
    ) {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException('Pago móvil/transferencia/punto debe ser en BS');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      if (rate.currency !== 'USD')
        throw new BadRequestException('Pago en BS requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'cash_bs') {
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS') throw new BadRequestException('cash_bs debe ser en BS');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      if (rate.currency !== 'USD')
        throw new BadRequestException('cash_bs requiere tasa USD/Bs');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'bank_transfer_usd') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency !== 'USD')
        throw new BadRequestException('Transferencia en dólares debe ser en USD');
      out.exchangeRateId = p.exchangeRateId ?? null;
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
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      if (rate.currency !== 'EUR')
        throw new BadRequestException('cash_eur requiere una tasa de cambio en EUR');
      out.exchangeRateId = p.exchangeRateId;
    } else if (p.type === 'other') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency === 'BS' || p.amountCurrency === 'EUR') {
        if (!p.exchangeRateId)
          throw new BadRequestException(
            `exchangeRateId requerido para pago other en ${p.amountCurrency}`,
          );
        const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
        if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
        if (p.amountCurrency === 'BS' && rate.currency !== 'USD')
          throw new BadRequestException('other en BS requiere tasa USD/Bs');
        if (p.amountCurrency === 'EUR' && rate.currency !== 'EUR')
          throw new BadRequestException('other en EUR requiere tasa EUR/Bs');
        out.exchangeRateId = p.exchangeRateId;
      }
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

  async create(dto: CreateOrderDto, user: AuthenticatedUser): Promise<Order> {
    await this.validateCoreReferences(dto, user);

    // Sin orders.edit-amount, el monto de órdenes no-seguro se fuerza a la suma Particular.
    let effectivePriceAmount = dto.priceAmount;
    if (
      dto.type !== 'insurance' &&
      !this.userHasPermission(user, PERMISSIONS.ORDERS.EDIT_AMOUNT)
    ) {
      effectivePriceAmount = await this.computeParticularSum(dto.serviceTypes);
    }

    // Snapshot Cashea: dos tramos (primera cuota + total). El monto de la
    // primera cuota lo ingresa el usuario; las tasas se toman de la config
    // global vigente. Comisión = primeraCuota × firstRate + total × totalRate.
    let casheaFields: {
      casheaFirstInstallmentAmount: string;
      casheaFirstInstallmentRate: string;
      casheaTotalRate: string;
    } | null = null;
    if (dto.type === 'cashea') {
      const firstAmount = dto.casheaFirstInstallmentAmount ?? 0;
      if (firstAmount > effectivePriceAmount) {
        throw new BadRequestException(
          'La primera cuota Cashea no puede superar el precio total de la orden',
        );
      }
      const cfg = await this.appConfig.getCasheaCommissionConfig();
      casheaFields = {
        casheaFirstInstallmentAmount: firstAmount.toFixed(2),
        casheaFirstInstallmentRate: cfg.firstInstallmentRate.toFixed(4),
        casheaTotalRate: cfg.totalRate.toFixed(4),
      };
    }

    const savedId = await this.dataSource.transaction(async (mgr) => {
      const orderNumber = await this.generateOrderNumber();
      const entity = mgr.create(Order, {
        orderNumber,
        branchId: dto.branchId,
        type: dto.type,
        status: 'draft',
        holderId: dto.holderId,
        patientId: dto.patientId,
        contractorId: dto.contractorId ?? null,
        insuranceId: dto.insuranceId ?? null,
        insuranceSource: dto.type === 'insurance' ? dto.insuranceSource ?? null : null,
        serviceKey:
          dto.type === 'insurance' && dto.serviceKey?.trim()
            ? dto.serviceKey.trim()
            : null,
        specialtyId: dto.specialtyId,
        orderDate: dto.orderDate,
        appointmentDate: new Date(dto.appointmentDate),
        priceAmount: effectivePriceAmount.toFixed(2),
        casheaFirstInstallmentAmount:
          casheaFields?.casheaFirstInstallmentAmount ?? null,
        casheaFirstInstallmentRate:
          casheaFields?.casheaFirstInstallmentRate ?? null,
        casheaTotalRate: casheaFields?.casheaTotalRate ?? null,
        useFixedRate: dto.type === 'insurance' && !!dto.useFixedRate,
        fixedExchangeRateId:
          dto.type === 'insurance' && dto.useFixedRate
            ? dto.fixedExchangeRateId ?? null
            : null,
        createdById: user.id,
      });
      const saved = await mgr.save(entity);

      // Insertar filas OST.
      await this.persistOrderServiceTypes(mgr, saved.id, dto.serviceTypes);

      const pIds = Array.from(new Set(dto.pathologyIds ?? []));
      if (pIds.length) {
        await mgr
          .createQueryBuilder()
          .relation(Order, 'pathologies')
          .of(saved.id)
          .add(pIds);
      }

      if (dto.type === 'cash' && dto.payments?.length) {
        for (const p of dto.payments) {
          const payload = await this.resolvePaymentForSave(p, null);
          await mgr.save(mgr.create(OrderPayment, { ...payload, orderId: saved.id }));
        }
      }

      // Snapshot de precios de cobro (Paso 1).
      await this.snapshotBuyerPricing(
        mgr,
        saved.id,
        dto.type,
        dto.insuranceId ?? null,
        dto.serviceTypes.map((r) => r.serviceTypeId),
      );

      // Auto-generación de cuentas: una accounts_payable por proveedor distinto.
      const distinct = this.distinctProvidersFromRows(dto.serviceTypes);
      for (const { providerType, providerId } of distinct) {
        const payableNumberRows = await mgr.query<{ nextval: string }[]>(
          `SELECT nextval('accounts_payable_seq') AS nextval`,
        );
        const payableNumber = String(payableNumberRows[0].nextval);
        await mgr.query(
          `INSERT INTO "accounts_payable" ("orderId", "payableNumber", "recipientType", "doctorId", "careCenterId")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [
            saved.id,
            payableNumber,
            providerType,
            providerType === 'doctor' ? providerId : null,
            providerType === 'care_center' ? providerId : null,
          ],
        );
      }
      // Auto-generación de cuenta por cobrar:
      //  - type='insurance' → deudor=seguro (insuranceId)
      //  - type='credit'    → deudor=titular (holderId)
      //  - type='cashea'    → deudor=titular (holderId). El target se ajusta por
      //                       comisión Cashea en AccountsReceivableService.
      // Misma tabla, mismo sequence; columnas insuranceId/holderId son XOR (CHECK ck_ar_debtor_xor).
      const arDebtor =
        dto.type === 'insurance' && dto.insuranceId
          ? { insuranceId: dto.insuranceId, holderId: null as string | null }
          : dto.type === 'credit' || dto.type === 'cashea'
            ? { insuranceId: null as string | null, holderId: dto.holderId }
            : null;
      if (arDebtor) {
        const receivableNumberRows = await mgr.query<{ nextval: string }[]>(
          `SELECT nextval('accounts_receivable_seq') AS nextval`,
        );
        const receivableNumber = String(receivableNumberRows[0].nextval);
        await mgr.query(
          `INSERT INTO "accounts_receivable" ("orderId", "receivableNumber", "insuranceId", "holderId")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ("orderId") DO NOTHING`,
          [saved.id, receivableNumber, arDebtor.insuranceId, arDebtor.holderId],
        );
      }

      return saved.id;
    });

    return this.findOne(savedId, user);
  }

  /** Replace-all de filas OST. Usa raw inserts para evitar problemas con composite PK + relations. */
  private async persistOrderServiceTypes(
    mgr: EntityManager,
    orderId: string,
    rows: OrderServiceTypeRowDto[],
  ): Promise<void> {
    await mgr.delete(OrderServiceType, { orderId });
    if (!rows.length) return;
    // Cantidad sólo para STs con allowsQuantity; el resto se fuerza a 1.
    const ids = Array.from(new Set(rows.map((r) => r.serviceTypeId)));
    const sts = await mgr.getRepository(ServiceType).find({
      where: { id: In(ids) },
      select: ['id', 'allowsQuantity'],
    });
    const allowsQtyById = new Map(sts.map((s) => [s.id, s.allowsQuantity]));
    const values = rows.map((r) => ({
      orderId,
      serviceTypeId: r.serviceTypeId,
      providerType: r.providerType,
      doctorId: r.providerType === 'doctor' ? r.doctorId ?? null : null,
      careCenterId: r.providerType === 'care_center' ? r.careCenterId ?? null : null,
      quantity: allowsQtyById.get(r.serviceTypeId)
        ? Math.max(1, Math.trunc(r.quantity ?? 1))
        : 1,
    }));
    await mgr.insert(OrderServiceType, values);
  }

  /** Set único de proveedores activos en la orden. Preserva orden de aparición. */
  private distinctProvidersFromRows(
    rows: OrderServiceTypeRowDto[],
  ): Array<{
    providerType: 'doctor' | 'care_center';
    providerId: string;
    key: ProviderKey;
  }> {
    const seen = new Set<string>();
    const out: Array<{
      providerType: 'doctor' | 'care_center';
      providerId: string;
      key: ProviderKey;
    }> = [];
    for (const r of rows) {
      const providerId =
        r.providerType === 'doctor' ? r.doctorId! : r.careCenterId!;
      const key = `${r.providerType}:${providerId}` as ProviderKey;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ providerType: r.providerType, providerId, key });
    }
    return out;
  }

  // ----- Transiciones de estado (Pasos 2-4) -----

  async attend(id: string, dto: AttendOrderDto, user: AuthenticatedUser): Promise<Order> {
    const order = await this.findOne(id, user);
    if (!['draft', 'in_progress', 'attended'].includes(order.status)) {
      throw new BadRequestException(
        'La orden no puede pasar a atendida desde su estado actual',
      );
    }
    const attendedAt = dto.attended
      ? dto.attendedAt
        ? new Date(dto.attendedAt)
        : new Date()
      : null;
    const status: OrderStatus = dto.attended
      ? 'attended'
      : order.status === 'attended'
        ? 'in_progress'
        : order.status;
    // `update` por columnas — la orden trae `providerReports` cargada y
    // `save(order)` intentaría sincronizar esa relación (nullear FKs).
    await this.repo.update(
      { id: order.id },
      { attended: dto.attended, attendedAt, status },
    );
    return this.findOne(id, user);
  }

  async report(id: string, dto: ReportOrderDto, user: AuthenticatedUser): Promise<Order> {
    const order = await this.findOne(id, user);
    // `otherStudies`, observaciones por proveedor y adjuntos son editables
    // retroactivamente. Solo se bloquea `draft`/`in_progress` (orden aún sin
    // atender — no tiene sentido emitir informe).
    if (order.status === 'draft' || order.status === 'in_progress') {
      throw new BadRequestException('La orden debe estar atendida para emitir informe');
    }

    const provider = await this.resolveProvider(user);

    // Proveedores distintos presentes en la orden (vía OST).
    const orderProviders = this.distinctProvidersFromRows(
      (order.orderServiceTypes ?? []).map((ost) => ({
        serviceTypeId: ost.serviceTypeId,
        providerType: ost.providerType,
        doctorId: ost.doctorId ?? undefined,
        careCenterId: ost.careCenterId ?? undefined,
      })),
    );
    const validKeys = new Set<string>(orderProviders.map((p) => p.key));

    await this.dataSource.transaction(async (mgr) => {
      // Patch de columnas escalares de la orden. Importante: NO usar
      // `mgr.save(order)` — la orden viene con la relación `providerReports`
      // cargada y `save` intentaría sincronizarla (nullear el FK de las filas
      // recién upserteadas). Se actualizan sólo columnas vía `mgr.update`.
      const patch: Partial<Order> = {};

      if (provider) {
        // Usuario proveedor: solo su propio segmento; no toca la nota general.
        const ownKey = `${provider.type}:${provider.id}`;
        if (!validKeys.has(ownKey)) {
          throw new ForbiddenException('No participás en esta orden');
        }
        for (const r of dto.providerReports ?? []) {
          const pid = r.providerType === 'doctor' ? r.doctorId : r.careCenterId;
          if (`${r.providerType}:${pid ?? ''}` !== ownKey) {
            throw new ForbiddenException(
              'Solo podés editar las observaciones de tu propio informe',
            );
          }
          await this.upsertProviderReport(
            mgr,
            order.id,
            provider.type,
            provider.id,
            r.observations ?? null,
          );
        }
      } else {
        // Staff: nota general + cualquier segmento de proveedor de la orden.
        if (dto.otherStudies !== undefined) {
          patch.otherStudies =
            dto.otherStudies && dto.otherStudies.trim() !== ''
              ? dto.otherStudies
              : null;
        }
        for (const r of dto.providerReports ?? []) {
          const pid = r.providerType === 'doctor' ? r.doctorId! : r.careCenterId!;
          const key = `${r.providerType}:${pid}`;
          if (!validKeys.has(key)) {
            throw new BadRequestException(
              `El proveedor del informe no participa en la orden (${key})`,
            );
          }
          await this.upsertProviderReport(
            mgr,
            order.id,
            r.providerType,
            pid,
            r.observations ?? null,
          );
        }
      }
      if (order.status === 'attended') patch.status = 'report_issued';
      if (Object.keys(patch).length) {
        await mgr.update(Order, { id: order.id }, patch);
      }
    });

    return this.findOne(id, user);
  }

  /** Upsert (por proveedor) de las observaciones del informe. */
  private async upsertProviderReport(
    mgr: EntityManager,
    orderId: string,
    providerType: 'doctor' | 'care_center',
    providerId: string,
    observations: string | null,
  ): Promise<void> {
    const obs = observations && observations.trim() !== '' ? observations : null;
    const doctorId = providerType === 'doctor' ? providerId : null;
    const careCenterId = providerType === 'care_center' ? providerId : null;
    // Raw SQL (igual que las cuentas auto-generadas): evita la ambigüedad de
    // mapeo columna/relación del FK `orderId` en el insert del ORM.
    const existing = await mgr.query<Array<{ id: string }>>(
      providerType === 'doctor'
        ? `SELECT id FROM "order_provider_reports" WHERE "orderId" = $1 AND "doctorId" = $2 LIMIT 1`
        : `SELECT id FROM "order_provider_reports" WHERE "orderId" = $1 AND "careCenterId" = $2 LIMIT 1`,
      [orderId, providerId],
    );
    if (existing[0]) {
      await mgr.query(
        `UPDATE "order_provider_reports" SET "observations" = $1, "updatedAt" = now() WHERE id = $2`,
        [obs, existing[0].id],
      );
    } else {
      await mgr.query(
        `INSERT INTO "order_provider_reports"
           ("orderId", "providerType", "doctorId", "careCenterId", "observations")
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, providerType, doctorId, careCenterId, obs],
      );
    }
  }

  /**
   * Paso 1 — Autorización de monto por un validador.
   *
   * Cuando el usuario que edita la orden no tiene `orders.edit-amount`, otro
   * usuario que sí lo tenga valida sus credenciales (email + contraseña) e
   * ingresa el nuevo monto + observación. Queda registrado como autor del cambio.
   * Sólo aplica a órdenes `draft` no-seguro (el monto de seguro es fijo).
   */
  async authorizeAmount(
    id: string,
    dto: AuthorizeOrderAmountDto,
    user: AuthenticatedUser,
  ): Promise<Order> {
    const order = await this.findOne(id, user);
    if (order.status !== 'draft') {
      throw new BadRequestException(
        'Solo se puede autorizar el monto mientras la orden está en borrador',
      );
    }
    if (order.type === 'insurance') {
      throw new BadRequestException('El monto de las órdenes de seguro es fijo');
    }

    const validator = await this.authService.verifyValidator(
      dto.validatorEmail,
      dto.validatorPassword,
    );
    const canEditAmount =
      validator.isSuperAdmin ||
      validator.permissions.includes(PERMISSIONS.ORDERS.EDIT_AMOUNT);
    if (!canEditAmount) {
      throw new ForbiddenException(
        'El validador no tiene permiso para modificar el monto',
      );
    }

    // `update` por columnas (la orden trae `providerReports` cargada).
    await this.repo.update(
      { id: order.id },
      {
        priceAmount: dto.priceAmount.toFixed(2),
        amountAuthorizedById: validator.id,
        amountAuthorizedAt: new Date(),
        amountAuthorizationNote: dto.observation.trim(),
      },
    );
    return this.findOne(id, user);
  }

  /**
   * Paso 4 — Facturación con pagos USD por proveedor.
   *
   * - `providers[]` debe cubrir exactamente el set de proveedores distintos de
   *   la orden (uno por proveedor; sin duplicados; sin sobrantes ni faltantes).
   * - Cada `amount` está en USD; cap global `Σ amount ≤ priceAmount`.
   * - Snapshot replace-all de `kind ∈ {doctor, care_center}` por ST.
   * - `doctorAmount` = total USD; `doctorAmountSuggested` = suma sugeridos USD.
   * - `billingExchangeRateId` debe ser tasa USD/Bs (snapshot al facturar).
   */
  async billing(id: string, dto: BillingOrderDto, user: AuthenticatedUser): Promise<Order> {
    const order = await this.findOne(id, user);
    if (order.status !== 'report_issued') {
      throw new BadRequestException(
        'La orden debe tener informe emitido para pasar a facturación',
      );
    }

    const rate = await resolveUsdRate(this.ratesRepo, dto.billingExchangeRateId);
    void rate;

    // Set de proveedores esperados según las filas OST de la orden.
    const orderRows = (order.orderServiceTypes ?? []).map((ost) => ({
      serviceTypeId: ost.serviceTypeId,
      providerType: ost.providerType,
      doctorId: ost.doctorId ?? undefined,
      careCenterId: ost.careCenterId ?? undefined,
    }));
    const qtyByST = new Map(
      (order.orderServiceTypes ?? []).map((ost) => [
        ost.serviceTypeId,
        ost.quantity ?? 1,
      ]),
    );
    const expected = this.distinctProvidersFromRows(orderRows);
    const expectedSet = new Set(expected.map((p) => p.key));

    // Set de proveedores en dto.providers.
    const seenKeys = new Set<string>();
    const dtoMap = new Map<ProviderKey, BillingProviderDto>();
    for (const p of dto.providers) {
      const pid = p.providerType === 'doctor' ? p.doctorId! : p.careCenterId!;
      const key = `${p.providerType}:${pid}` as ProviderKey;
      if (seenKeys.has(key)) {
        throw new BadRequestException(
          'Proveedor duplicado en la facturación',
        );
      }
      seenKeys.add(key);
      dtoMap.set(key, p);
    }
    if (seenKeys.size !== expectedSet.size) {
      throw new BadRequestException(
        'Cantidad de proveedores facturados no coincide con la orden',
      );
    }
    for (const key of expectedSet) {
      if (!seenKeys.has(key))
        throw new BadRequestException(
          `Falta el pago para un proveedor de la orden (${key})`,
        );
    }
    for (const key of seenKeys) {
      if (!expectedSet.has(key as ProviderKey))
        throw new BadRequestException(
          `Proveedor facturado no participa en la orden (${key})`,
        );
    }

    // Total USD + validación cap.
    const priceAmount = Number(order.priceAmount);
    let totalUsd = 0;
    for (const p of dto.providers) {
      totalUsd += p.amount;
    }
    if (totalUsd > priceAmount + 0.005) {
      throw new BadRequestException(
        'La suma de pagos a proveedores supera el monto declarado de la orden',
      );
    }

    // Sugeridos + snapshots per provider.
    let suggestedSum = 0;
    const snapshotRows: Array<{
      orderId: string;
      serviceTypeId: string;
      kind: 'doctor' | 'care_center';
      priceUsd: string;
    }> = [];
    for (const prov of expected) {
      const rowsForProv = orderRows.filter((r) => {
        const pid =
          r.providerType === 'doctor' ? r.doctorId : r.careCenterId;
        return r.providerType === prov.providerType && pid === prov.providerId;
      });
      const stIds = rowsForProv.map((r) => r.serviceTypeId);
      const { suggested, snapshotRows: rows } = await this.computeProviderPricing(
        prov.providerType,
        prov.providerId,
        stIds,
        qtyByST,
      );
      suggestedSum += suggested;
      snapshotRows.push(...rows);
    }

    // Replace-all snapshots del lado pago + per-account providerAmount.
    await this.dataSource.transaction(async (mgr) => {
      // `update` por columnas — la orden trae `providerReports` cargada y
      // `save(order)` intentaría sincronizar esa relación (nullear FKs).
      await mgr.update(
        Order,
        { id: order.id },
        {
          doctorAmountSuggested: suggestedSum.toFixed(2),
          doctorAmount: totalUsd.toFixed(2),
          billingExchangeRateId: dto.billingExchangeRateId,
          status: 'finalized',
        },
      );
      await mgr.delete(OrderServicePricing, {
        orderId: order.id,
        kind: In(['doctor', 'care_center']),
      });
      if (snapshotRows.length) {
        await mgr.insert(
          OrderServicePricing,
          snapshotRows.map((r) => ({ ...r, orderId: order.id })),
        );
      }

      // Escribir monto USD por cada accounts_payable de la orden, matched por proveedor.
      for (const p of dto.providers) {
        const providerId =
          p.providerType === 'doctor' ? p.doctorId! : p.careCenterId!;
        await mgr.query(
          `UPDATE "accounts_payable"
           SET "providerAmount" = $1
           WHERE "orderId" = $2
             AND "recipientType" = $3
             AND COALESCE("doctorId", "careCenterId") = $4
             AND "deletedAt" IS NULL`,
          [
            p.amount.toFixed(2),
            order.id,
            p.providerType,
            providerId,
          ],
        );
      }
    });
    return this.findOne(id, user);
  }

  private async snapshotBuyerPricing(
    mgr: EntityManager,
    orderId: string,
    type: 'cash' | 'credit' | 'insurance' | 'cashea',
    insuranceId: string | null,
    serviceTypeIds: string[],
  ): Promise<void> {
    if (!serviceTypeIds.length) return;
    if (type === 'insurance' && insuranceId) {
      const rows = await mgr
        .getRepository(InsuranceServicePrice)
        .find({
          where: { insuranceId, serviceTypeId: In(serviceTypeIds) },
        });
      const byST = new Map(rows.map((r) => [r.serviceTypeId, r]));
      const missing = serviceTypeIds.filter((id) => !byST.has(id));
      if (missing.length) {
        throw new BadRequestException(
          `El seguro seleccionado no tiene precio definido para algún tipo de servicio (${missing.length} pendiente${missing.length === 1 ? '' : 's'}). Cargá los precios en el seguro o quitá esos servicios.`,
        );
      }
      const values = serviceTypeIds.map((stId) => {
        const r = byST.get(stId)!;
        return {
          orderId,
          serviceTypeId: stId,
          kind: 'insurance' as const,
          priceUsd: r.priceUsd,
        };
      });
      await mgr.insert(OrderServicePricing, values);
    } else {
      const sts = await mgr.getRepository(ServiceType).find({
        where: { id: In(serviceTypeIds) },
      });
      const values = sts.map((st) => ({
        orderId,
        serviceTypeId: st.id,
        kind: 'particular' as const,
        priceUsd: st.particularPriceUsd ?? '0',
      }));
      if (values.length) await mgr.insert(OrderServicePricing, values);
    }
  }

  /**
   * Sugerido + snapshots para los STs de un proveedor en una moneda.
   * STs sin precio definido omitidos del sugerido.
   */
  private async computeProviderPricing(
    providerType: 'doctor' | 'care_center',
    providerId: string,
    serviceTypeIds: string[],
    qtyByST?: Map<string, number>,
  ): Promise<{
    suggested: number;
    snapshotRows: Array<{
      orderId: string;
      serviceTypeId: string;
      kind: 'doctor' | 'care_center';
      priceUsd: string;
    }>;
  }> {
    if (!serviceTypeIds.length) return { suggested: 0, snapshotRows: [] };

    const rows =
      providerType === 'doctor'
        ? await this.doctorPricesRepo.find({
            where: { doctorId: providerId, serviceTypeId: In(serviceTypeIds) },
          })
        : await this.careCenterPricesRepo.find({
            where: { careCenterId: providerId, serviceTypeId: In(serviceTypeIds) },
          });

    let suggested = 0;
    const snapshotRows: Array<{
      orderId: string;
      serviceTypeId: string;
      kind: 'doctor' | 'care_center';
      priceUsd: string;
    }> = [];
    for (const r of rows) {
      const amount = Number(r.priceUsd);
      const qty = Math.max(1, Math.trunc(qtyByST?.get(r.serviceTypeId) ?? 1));
      if (Number.isFinite(amount)) suggested += amount * qty;
      snapshotRows.push({
        orderId: '',
        serviceTypeId: r.serviceTypeId,
        kind: providerType,
        priceUsd: r.priceUsd,
      });
    }
    return { suggested: +suggested.toFixed(2), snapshotRows };
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthenticatedUser): Promise<Order> {
    const existing = await this.findOne(id, user);
    if (existing.status !== 'draft')
      throw new BadRequestException('Solo se puede editar órdenes en borrador');

    const existingPathologyIds = (existing.pathologies ?? []).map((p) => p.id);
    const existingRows: OrderServiceTypeRowDto[] = (
      existing.orderServiceTypes ?? []
    ).map((ost) => ({
      serviceTypeId: ost.serviceTypeId,
      providerType: ost.providerType,
      doctorId: ost.doctorId ?? undefined,
      careCenterId: ost.careCenterId ?? undefined,
      quantity: ost.quantity ?? 1,
    }));

    const merged: CreateOrderDto = {
      branchId: dto.branchId ?? existing.branchId,
      type: (dto.type ?? existing.type) as CreateOrderDto['type'],
      holderId: dto.holderId ?? existing.holderId,
      patientId: dto.patientId ?? existing.patientId,
      contractorId: dto.contractorId ?? existing.contractorId ?? undefined,
      insuranceId: dto.insuranceId ?? existing.insuranceId ?? undefined,
      insuranceSource:
        (dto.insuranceSource ?? existing.insuranceSource ?? undefined) as
          | 'direct'
          | 'via_contractor'
          | undefined,
      serviceKey:
        dto.serviceKey !== undefined
          ? dto.serviceKey
          : existing.serviceKey ?? undefined,
      specialtyId: dto.specialtyId ?? existing.specialtyId,
      serviceTypes: dto.serviceTypes ?? existingRows,
      pathologyIds: dto.pathologyIds ?? existingPathologyIds,
      orderDate: dto.orderDate ?? existing.orderDate,
      appointmentDate:
        dto.appointmentDate ?? existing.appointmentDate.toISOString(),
      priceAmount: dto.priceAmount ?? Number(existing.priceAmount),
      casheaFirstInstallmentAmount:
        dto.casheaFirstInstallmentAmount ??
        (existing.casheaFirstInstallmentAmount != null
          ? Number(existing.casheaFirstInstallmentAmount)
          : undefined),
      useFixedRate: dto.useFixedRate ?? existing.useFixedRate,
      fixedExchangeRateId:
        dto.fixedExchangeRateId ?? existing.fixedExchangeRateId ?? undefined,
    };
    await this.validateCoreReferences(merged, user);

    // Sin orders.edit-amount, el monto de órdenes no-seguro se fuerza a la suma Particular.
    if (
      merged.type !== 'insurance' &&
      !this.userHasPermission(user, PERMISSIONS.ORDERS.EDIT_AMOUNT)
    ) {
      merged.priceAmount = await this.computeParticularSum(merged.serviceTypes);
    }

    // Snapshot Cashea (dos tramos): si pasa a cashea desde otro tipo, capturar
    // tasas de la config global; si ya era cashea, preservar tasas snapshot y
    // sólo actualizar el monto de la primera cuota; si deja de ser cashea,
    // limpiar los tres campos. `undefined` = no tocar.
    let nextCashea:
      | {
          casheaFirstInstallmentAmount: string;
          casheaFirstInstallmentRate: string;
          casheaTotalRate: string;
        }
      | null
      | undefined = undefined;
    if (merged.type === 'cashea') {
      const firstAmount = merged.casheaFirstInstallmentAmount ?? 0;
      if (firstAmount > merged.priceAmount) {
        throw new BadRequestException(
          'La primera cuota Cashea no puede superar el precio total de la orden',
        );
      }
      let firstRate: string;
      let totalRate: string;
      if (existing.type === 'cashea') {
        // Preservar snapshot de tasas; sólo cambia el monto de la primera cuota.
        const cfg = await this.appConfig.getCasheaCommissionConfig();
        firstRate =
          existing.casheaFirstInstallmentRate ??
          cfg.firstInstallmentRate.toFixed(4);
        totalRate = existing.casheaTotalRate ?? cfg.totalRate.toFixed(4);
      } else {
        const cfg = await this.appConfig.getCasheaCommissionConfig();
        firstRate = cfg.firstInstallmentRate.toFixed(4);
        totalRate = cfg.totalRate.toFixed(4);
      }
      nextCashea = {
        casheaFirstInstallmentAmount: firstAmount.toFixed(2),
        casheaFirstInstallmentRate: firstRate,
        casheaTotalRate: totalRate,
      };
    } else if (existing.type === 'cashea') {
      nextCashea = null;
    }

    await this.dataSource.transaction(async (mgr) => {
      Object.assign(existing, {
        branchId: merged.branchId,
        type: merged.type,
        holderId: merged.holderId,
        patientId: merged.patientId,
        contractorId: merged.contractorId ?? null,
        insuranceId: merged.insuranceId ?? null,
        insuranceSource:
          merged.type === 'insurance' ? merged.insuranceSource ?? null : null,
        serviceKey:
          merged.type === 'insurance' && merged.serviceKey?.trim()
            ? merged.serviceKey.trim()
            : null,
        specialtyId: merged.specialtyId,
        orderDate: merged.orderDate,
        appointmentDate: new Date(merged.appointmentDate),
        priceAmount: merged.priceAmount.toFixed(2),
        ...(nextCashea !== undefined
          ? nextCashea === null
            ? {
                casheaFirstInstallmentAmount: null,
                casheaFirstInstallmentRate: null,
                casheaTotalRate: null,
              }
            : nextCashea
          : {}),
        useFixedRate: merged.type === 'insurance' && !!merged.useFixedRate,
        fixedExchangeRateId:
          merged.type === 'insurance' && merged.useFixedRate
            ? merged.fixedExchangeRateId ?? null
            : null,
      });
      await mgr.save(existing);

      // Replace OST rows.
      await this.persistOrderServiceTypes(mgr, existing.id, merged.serviceTypes);

      // Pathologies replace.
      const pRel = mgr.createQueryBuilder().relation(Order, 'pathologies').of(existing.id);
      if (existingPathologyIds.length) await pRel.remove(existingPathologyIds);
      if (merged.pathologyIds && merged.pathologyIds.length)
        await pRel.add(Array.from(new Set(merged.pathologyIds)));

      if (dto.payments !== undefined) {
        await mgr.delete(OrderPayment, { orderId: existing.id });
        if (merged.type === 'cash' && dto.payments.length) {
          for (const p of dto.payments) {
            const payload = await this.resolvePaymentForSave(p, null);
            await mgr.save(mgr.create(OrderPayment, { ...payload, orderId: existing.id }));
          }
        }
      }

      // Re-snapshot buyer pricing.
      await mgr.delete(OrderServicePricing, {
        orderId: existing.id,
        kind: In(['particular', 'insurance']),
      });
      await this.snapshotBuyerPricing(
        mgr,
        existing.id,
        merged.type,
        merged.insuranceId ?? null,
        merged.serviceTypes.map((r) => r.serviceTypeId),
      );

      // Reconciliar accounts_payable según nuevos proveedores distintos.
      const distinct = this.distinctProvidersFromRows(merged.serviceTypes);
      // Mantiene las existentes que aún correspondan; soft-deletea las huérfanas.
      const existingAccounts = await mgr.query<
        Array<{ id: string; recipientType: string; doctorId: string | null; careCenterId: string | null }>
      >(
        `SELECT id, "recipientType", "doctorId", "careCenterId"
         FROM "accounts_payable"
         WHERE "orderId" = $1 AND "deletedAt" IS NULL`,
        [existing.id],
      );
      const keepKeys = new Set(
        distinct.map((p) => `${p.providerType}:${p.providerId}`),
      );
      for (const acc of existingAccounts) {
        const accKey = `${acc.recipientType}:${
          acc.recipientType === 'doctor' ? acc.doctorId : acc.careCenterId
        }`;
        if (!keepKeys.has(accKey)) {
          await mgr.query(
            `UPDATE "accounts_payable" SET "deletedAt" = now() WHERE id = $1`,
            [acc.id],
          );
        }
      }
      const existingKeys = new Set(
        existingAccounts
          .map(
            (acc) =>
              `${acc.recipientType}:${
                acc.recipientType === 'doctor' ? acc.doctorId : acc.careCenterId
              }`,
          )
          .filter((k) => keepKeys.has(k)),
      );
      for (const { providerType, providerId, key } of distinct) {
        if (existingKeys.has(key)) continue;
        const payableNumberRows = await mgr.query<{ nextval: string }[]>(
          `SELECT nextval('accounts_payable_seq') AS nextval`,
        );
        const payableNumber = String(payableNumberRows[0].nextval);
        await mgr.query(
          `INSERT INTO "accounts_payable" ("orderId", "payableNumber", "recipientType", "doctorId", "careCenterId")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [
            existing.id,
            payableNumber,
            providerType,
            providerType === 'doctor' ? providerId : null,
            providerType === 'care_center' ? providerId : null,
          ],
        );
      }

      // Reconciliar cuenta por cobrar según merged.type. Una orden tiene a lo
      // sumo una AR activa por su UNIQUE en orderId.
      const arDebtor =
        merged.type === 'insurance' && merged.insuranceId
          ? { insuranceId: merged.insuranceId, holderId: null as string | null }
          : merged.type === 'credit' || merged.type === 'cashea'
            ? { insuranceId: null as string | null, holderId: merged.holderId }
            : null;
      const existingArRows = await mgr.query<
        Array<{ id: string; insuranceId: string | null; holderId: string | null }>
      >(
        `SELECT id, "insuranceId", "holderId"
         FROM "accounts_receivable"
         WHERE "orderId" = $1 AND "deletedAt" IS NULL`,
        [existing.id],
      );
      const currentAr = existingArRows[0] ?? null;
      const matchesDebtor =
        currentAr &&
        arDebtor &&
        currentAr.insuranceId === arDebtor.insuranceId &&
        currentAr.holderId === arDebtor.holderId;
      if (currentAr && !matchesDebtor) {
        await mgr.query(
          `UPDATE "accounts_receivable" SET "deletedAt" = now() WHERE id = $1`,
          [currentAr.id],
        );
      }
      if (arDebtor && !matchesDebtor) {
        const receivableNumberRows = await mgr.query<{ nextval: string }[]>(
          `SELECT nextval('accounts_receivable_seq') AS nextval`,
        );
        const receivableNumber = String(receivableNumberRows[0].nextval);
        await mgr.query(
          `INSERT INTO "accounts_receivable" ("orderId", "receivableNumber", "insuranceId", "holderId")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ("orderId") DO NOTHING`,
          [existing.id, receivableNumber, arDebtor.insuranceId, arDebtor.holderId],
        );
      }
    });

    return this.findOne(existing.id, user);
  }

  /**
   * Soft-delete cascada: marca `deletedAt` con el mismo timestamp en orden,
   * accounts_payable y accounts_receivable. Mantener un timestamp común
   * permite que `restore` revierta exactamente las filas tumbadas por esta
   * cascada y respete las cuentas que pudieran estar previamente eliminadas.
   *
   * `taxes_payable` NO se toca: el comprobante de retención es un documento
   * fiscal histórico ligado al pago realizado, no a la orden.
   */
  async softDelete(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user);
    await this.dataSource.transaction(async (mgr) => {
      const ts = new Date();
      await mgr.query(
        `UPDATE "accounts_payable" SET "deletedAt" = $1 WHERE "orderId" = $2 AND "deletedAt" IS NULL`,
        [ts, id],
      );
      await mgr.query(
        `UPDATE "accounts_receivable" SET "deletedAt" = $1 WHERE "orderId" = $2 AND "deletedAt" IS NULL`,
        [ts, id],
      );
      await mgr.update(Order, { id }, { deletedAt: ts });
    });
  }

  async hardDelete(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user, true);
    await this.repo.delete(id);
  }

  async restore(id: string, user: AuthenticatedUser): Promise<Order> {
    const order = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!order) throw new NotFoundException('Orden no encontrada');
    await this.assertBranchVisibility(order.branchId, user);
    if (!order.deletedAt) return this.findOne(id, user);
    const ts = order.deletedAt;
    await this.dataSource.transaction(async (mgr) => {
      await mgr.query(
        `UPDATE "accounts_payable" SET "deletedAt" = NULL WHERE "orderId" = $1 AND "deletedAt" = $2`,
        [id, ts],
      );
      await mgr.query(
        `UPDATE "accounts_receivable" SET "deletedAt" = NULL WHERE "orderId" = $1 AND "deletedAt" = $2`,
        [id, ts],
      );
      await mgr.update(Order, { id }, { deletedAt: null });
    });
    return this.findOne(id, user);
  }

  // ------- Payments subresource -------

  async addPayment(
    orderId: string,
    dto: CreateOrderPaymentDto,
    user: AuthenticatedUser,
  ): Promise<OrderPayment> {
    const order = await this.findOne(orderId, user);
    if (order.status !== 'draft')
      throw new BadRequestException('Solo se permiten pagos en órdenes en borrador');
    if (order.type !== 'cash')
      throw new BadRequestException('Solo se admiten pagos para órdenes de tipo Contado');
    const payload = await this.resolvePaymentForSave(
      dto,
      order.billingExchangeRateId ?? null,
    );
    const entity = this.paymentsRepo.create({ ...payload, orderId });
    return this.paymentsRepo.save(entity);
  }

  async updatePayment(
    orderId: string,
    paymentId: string,
    dto: UpdateOrderPaymentDto,
    user: AuthenticatedUser,
  ): Promise<OrderPayment> {
    const order = await this.findOne(orderId, user);
    if (order.status !== 'draft')
      throw new BadRequestException('Solo se permiten pagos en órdenes en borrador');
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId, orderId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    const merged: CreateOrderPaymentDto = {
      type: (dto.type ?? payment.type) as CreateOrderPaymentDto['type'],
      paymentDate: dto.paymentDate ?? payment.paymentDate,
      referenceNumber: dto.referenceNumber ?? payment.referenceNumber ?? undefined,
      bankCode: dto.bankCode ?? payment.bankCode ?? undefined,
      accountNumber: dto.accountNumber ?? payment.accountNumber ?? undefined,
      exchangeRateId: dto.exchangeRateId ?? payment.exchangeRateId ?? undefined,
      amountCurrency: (dto.amountCurrency ??
        payment.amountCurrency) as CreateOrderPaymentDto['amountCurrency'],
      amountValue: dto.amountValue ?? Number(payment.amountValue),
    };
    const payload = await this.resolvePaymentForSave(
      merged,
      order.billingExchangeRateId ?? null,
    );
    Object.assign(payment, payload);
    return this.paymentsRepo.save(payment);
  }

  async removePayment(
    orderId: string,
    paymentId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const order = await this.findOne(orderId, user);
    if (order.status !== 'draft')
      throw new BadRequestException('Solo se permiten cambios de pagos en borrador');
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId, orderId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    await this.paymentsRepo.delete(paymentId);
  }
}

void In;
