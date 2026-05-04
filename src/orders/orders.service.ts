import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { CreateOrderPaymentDto, UpdateOrderPaymentDto } from './dto/order-payment.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['in_progress', 'cancelled'],
  in_progress: ['attended', 'cancelled'],
  attended: ['report_issued', 'cancelled'],
  report_issued: ['finalized', 'cancelled'],
  finalized: [],
  cancelled: [],
};
void ALLOWED_TRANSITIONS;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly repo: Repository<Order>,
    @InjectRepository(OrderPayment) private readonly paymentsRepo: Repository<OrderPayment>,
    @InjectRepository(Patient) private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Doctor) private readonly doctorsRepo: Repository<Doctor>,
    @InjectRepository(CareCenter) private readonly careCentersRepo: Repository<CareCenter>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(ExchangeRate) private readonly ratesRepo: Repository<ExchangeRate>,
    private readonly dataSource: DataSource,
  ) {}

  /** Sucursales efectivas del usuario actual: Super Admin → todas activas; regular → asignadas activas. */
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
    const n = Number(result[0].nextval);
    const year = new Date().getUTCFullYear();
    return `ORD-${year}-${String(n).padStart(6, '0')}`;
  }

  private orderRelations() {
    return {
      branch: true,
      holder: true,
      patient: true,
      contractor: true,
      insurance: true,
      doctor: true,
      careCenter: true,
      specialty: true,
      serviceType: true,
      pathology: true,
      createdBy: true,
      payments: { exchangeRate: true },
    } as const;
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
      .leftJoinAndSelect('o.patient', 'patient')
      .leftJoinAndSelect('o.doctor', 'doctor')
      .leftJoinAndSelect('o.careCenter', 'careCenter')
      .leftJoinAndSelect('o.specialty', 'specialty')
      .leftJoinAndSelect('o.serviceType', 'serviceType')
      .leftJoinAndSelect('o.pathology', 'pathology')
      .leftJoinAndSelect('o.contractor', 'contractor')
      .leftJoinAndSelect('o.insurance', 'insurance')
      .orderBy(`o.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('o.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (!user.isSuperAdmin) {
      const allowed = await this.resolveUserBranchIds(user);
      if (allowed.length === 0) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('o.branchId IN (:...allowed)', { allowed });
      }
    }

    if (branchId) qb.andWhere('o.branchId = :branchId', { branchId });
    if (status) qb.andWhere('o.status = :status', { status });
    if (type) qb.andWhere('o.type = :type', { type });
    if (doctorId) qb.andWhere('o.doctorId = :doctorId', { doctorId });
    if (careCenterId) qb.andWhere('o.careCenterId = :careCenterId', { careCenterId });
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

    return paginateBuilder<Order>(qb, page, limit);
  }

  async findOne(id: string, user: AuthenticatedUser, withDeleted = false): Promise<Order> {
    const order = await this.repo.findOne({
      where: { id },
      relations: this.orderRelations(),
      withDeleted,
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    await this.assertBranchVisibility(order.branchId, user);
    return order;
  }

  private async assertBranchVisibility(branchId: string, user: AuthenticatedUser): Promise<void> {
    if (user.isSuperAdmin) return;
    const allowed = await this.resolveUserBranchIds(user);
    if (!allowed.includes(branchId)) {
      throw new ForbiddenException('No tenés acceso a esta sucursal');
    }
  }

  private async validateCoreReferences(
    dto: Partial<CreateOrderDto>,
    user: AuthenticatedUser,
  ): Promise<{ holder: Patient }> {
    if (!dto.branchId) throw new BadRequestException('branchId requerido');
    await this.assertBranchVisibility(dto.branchId, user);

    if (!dto.providerType) throw new BadRequestException('providerType requerido');
    if (dto.providerType === 'doctor') {
      if (!dto.doctorId) throw new BadRequestException('doctorId requerido para providerType=doctor');
      if (dto.careCenterId) throw new BadRequestException('careCenterId no admitido para providerType=doctor');
    } else {
      if (!dto.careCenterId) throw new BadRequestException('careCenterId requerido para providerType=care_center');
      if (dto.doctorId) throw new BadRequestException('doctorId no admitido para providerType=care_center');
    }

    if (dto.providerType === 'doctor') {
      const doc = await this.doctorsRepo.findOne({
        where: { id: dto.doctorId!, deletedAt: IsNull() },
        relations: { specialties: true },
      });
      if (!doc) throw new BadRequestException('Doctor no encontrado o eliminado');
      const has = (doc.specialties ?? []).some((s) => s.id === dto.specialtyId);
      if (!has)
        throw new BadRequestException('Especialidad no pertenece al doctor seleccionado');
    } else {
      const cc = await this.careCentersRepo.findOne({
        where: { id: dto.careCenterId!, deletedAt: IsNull() },
        relations: { specialties: true },
      });
      if (!cc) throw new BadRequestException('Centro no encontrado o eliminado');
      const has = (cc.specialties ?? []).some((s) => s.id === dto.specialtyId);
      if (!has)
        throw new BadRequestException('Especialidad no pertenece al centro seleccionado');
    }

    const holder = await this.patientsRepo.findOne({
      where: { id: dto.holderId!, deletedAt: IsNull() },
      relations: { contractors: true, insurances: true },
    });
    if (!holder) throw new BadRequestException('Titular no encontrado o eliminado');

    if (dto.patientId && dto.patientId !== dto.holderId) {
      const pat = await this.patientsRepo.findOne({
        where: { id: dto.patientId, deletedAt: IsNull() },
      });
      if (!pat) throw new BadRequestException('Paciente no encontrado o eliminado');
    }

    if (dto.type === 'insurance') {
      if (!dto.contractorId || !dto.insuranceId)
        throw new BadRequestException('Tipo seguro: contractorId e insuranceId requeridos');
      const okContractor = (holder.contractors ?? []).some((c) => c.id === dto.contractorId);
      if (!okContractor)
        throw new BadRequestException('Contratista no asignado al titular');
      const okInsurance = (holder.insurances ?? []).some((i) => i.id === dto.insuranceId);
      if (!okInsurance) throw new BadRequestException('Seguro no asignado al titular');
    } else if (dto.contractorId || dto.insuranceId) {
      throw new BadRequestException('contractorId/insuranceId solo válidos para tipo seguro');
    }

    if (dto.orderDate && dto.appointmentDate) {
      if (new Date(dto.appointmentDate) < new Date(dto.orderDate))
        throw new BadRequestException('appointmentDate debe ser ≥ orderDate');
    }

    return { holder };
  }

  private async resolvePaymentForSave(
    p: CreateOrderPaymentDto,
    orderCurrency: 'USD' | 'EUR',
  ): Promise<Partial<OrderPayment>> {
    const out: Partial<OrderPayment> = {
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
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS')
        throw new BadRequestException('Pago móvil/transferencia debe ser en BS');
      const bank = await this.banksRepo.findOne({ where: { code: p.bankCode } });
      if (!bank) throw new BadRequestException('Banco no encontrado');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      out.bankCode = p.bankCode;
      out.exchangeRateId = p.exchangeRateId;
      out.amountInBs = p.amountValue.toFixed(2);
    } else if (p.type === 'cash_bs') {
      if (!p.exchangeRateId) throw new BadRequestException('exchangeRateId requerido');
      if (p.amountCurrency !== 'BS') throw new BadRequestException('cash_bs debe ser en BS');
      const rate = await this.ratesRepo.findOne({ where: { id: p.exchangeRateId } });
      if (!rate) throw new BadRequestException('Tasa de cambio no encontrada');
      out.exchangeRateId = p.exchangeRateId;
      out.amountInBs = p.amountValue.toFixed(2);
    } else if (p.type === 'cash_foreign') {
      if (p.amountCurrency !== orderCurrency)
        throw new BadRequestException(
          `cash_foreign: amountCurrency debe coincidir con priceCurrency (${orderCurrency})`,
        );
      out.amountInBs = '0';
    } else if (p.type === 'other') {
      if (!p.referenceNumber) throw new BadRequestException('referenceNumber requerido');
      if (p.amountCurrency !== orderCurrency)
        throw new BadRequestException(
          `other: amountCurrency debe coincidir con priceCurrency (${orderCurrency})`,
        );
      out.accountNumber = p.accountNumber ?? null;
      out.amountInBs = '0';
    }
    return out;
  }

  async create(dto: CreateOrderDto, user: AuthenticatedUser): Promise<Order> {
    await this.validateCoreReferences(dto, user);

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
        providerType: dto.providerType,
        doctorId: dto.providerType === 'doctor' ? dto.doctorId : null,
        careCenterId: dto.providerType === 'care_center' ? dto.careCenterId : null,
        specialtyId: dto.specialtyId,
        serviceTypeId: dto.serviceTypeId,
        pathologyId: dto.pathologyId,
        orderDate: dto.orderDate,
        appointmentDate: new Date(dto.appointmentDate),
        priceCurrency: dto.priceCurrency,
        priceAmount: dto.priceAmount.toFixed(2),
        createdById: user.id,
      });
      const saved = await mgr.save(entity);

      if (dto.type === 'cash' && dto.payments?.length) {
        for (const p of dto.payments) {
          const payload = await this.resolvePaymentForSave(p, dto.priceCurrency);
          await mgr.save(mgr.create(OrderPayment, { ...payload, orderId: saved.id }));
        }
      }

      return saved.id;
    });

    return this.findOne(savedId, user);
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthenticatedUser): Promise<Order> {
    const existing = await this.findOne(id, user);
    if (existing.status !== 'draft')
      throw new BadRequestException('Solo se puede editar órdenes en borrador');

    const merged: CreateOrderDto = {
      branchId: dto.branchId ?? existing.branchId,
      type: (dto.type ?? existing.type) as CreateOrderDto['type'],
      holderId: dto.holderId ?? existing.holderId,
      patientId: dto.patientId ?? existing.patientId,
      contractorId: dto.contractorId ?? existing.contractorId ?? undefined,
      insuranceId: dto.insuranceId ?? existing.insuranceId ?? undefined,
      providerType: (dto.providerType ?? existing.providerType) as CreateOrderDto['providerType'],
      doctorId: dto.doctorId ?? existing.doctorId ?? undefined,
      careCenterId: dto.careCenterId ?? existing.careCenterId ?? undefined,
      specialtyId: dto.specialtyId ?? existing.specialtyId,
      serviceTypeId: dto.serviceTypeId ?? existing.serviceTypeId,
      pathologyId: dto.pathologyId ?? existing.pathologyId,
      orderDate: dto.orderDate ?? existing.orderDate,
      appointmentDate:
        dto.appointmentDate ?? existing.appointmentDate.toISOString(),
      priceCurrency: (dto.priceCurrency ?? existing.priceCurrency) as 'USD' | 'EUR',
      priceAmount: dto.priceAmount ?? Number(existing.priceAmount),
    };
    await this.validateCoreReferences(merged, user);

    await this.dataSource.transaction(async (mgr) => {
      Object.assign(existing, {
        branchId: merged.branchId,
        type: merged.type,
        holderId: merged.holderId,
        patientId: merged.patientId,
        contractorId: merged.contractorId ?? null,
        insuranceId: merged.insuranceId ?? null,
        providerType: merged.providerType,
        doctorId: merged.providerType === 'doctor' ? merged.doctorId : null,
        careCenterId: merged.providerType === 'care_center' ? merged.careCenterId : null,
        specialtyId: merged.specialtyId,
        serviceTypeId: merged.serviceTypeId,
        pathologyId: merged.pathologyId,
        orderDate: merged.orderDate,
        appointmentDate: new Date(merged.appointmentDate),
        priceCurrency: merged.priceCurrency,
        priceAmount: merged.priceAmount.toFixed(2),
      });
      await mgr.save(existing);

      if (dto.payments !== undefined) {
        await mgr.delete(OrderPayment, { orderId: existing.id });
        if (merged.type === 'cash' && dto.payments.length) {
          for (const p of dto.payments) {
            const payload = await this.resolvePaymentForSave(p, merged.priceCurrency);
            await mgr.save(mgr.create(OrderPayment, { ...payload, orderId: existing.id }));
          }
        }
      }
    });

    return this.findOne(existing.id, user);
  }

  async softDelete(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user);
    await this.repo.softDelete(id);
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
    await this.repo.restore(id);
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
    const payload = await this.resolvePaymentForSave(dto, order.priceCurrency);
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
    const payload = await this.resolvePaymentForSave(merged, order.priceCurrency);
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
