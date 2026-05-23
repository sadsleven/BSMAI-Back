import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { CareCenter } from './entities/care-center.entity';
import { CareCenterPhone } from './entities/care-center-phone.entity';
import { CareCenterPaymentMethod } from './entities/care-center-payment-method.entity';
import { CareCenterServicePrice } from './entities/care-center-service-price.entity';
import { Specialty } from '../specialties/entities/specialty.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { ServicePriceDto } from '../shared/dto/service-price.dto';
import { CreateCareCenterDto } from './dto/create-care-center.dto';
import { UpdateCareCenterDto } from './dto/update-care-center.dto';
import { QueryCareCentersDto } from './dto/query-care-centers.dto';
import { PhoneDto } from './dto/phone.dto';
import { PaymentMethodDto } from './dto/payment-method.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import { normalizeRif } from '../shared/validators/ve-formats';

@Injectable()
export class CareCentersService {
  constructor(
    @InjectRepository(CareCenter) private readonly repo: Repository<CareCenter>,
    @InjectRepository(CareCenterPhone)
    private readonly phonesRepo: Repository<CareCenterPhone>,
    @InjectRepository(CareCenterPaymentMethod)
    private readonly methodsRepo: Repository<CareCenterPaymentMethod>,
    @InjectRepository(Specialty)
    private readonly specialtiesRepo: Repository<Specialty>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(CareCenterServicePrice)
    private readonly pricesRepo: Repository<CareCenterServicePrice>,
    @InjectRepository(ServiceType)
    private readonly serviceTypesRepo: Repository<ServiceType>,
  ) {}

  async findAll(query: QueryCareCentersDto): Promise<PaginatedResponse<CareCenter>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
      isActive,
      specialtyId,
    } = query;

    const qb = this.repo
      .createQueryBuilder('center')
      .leftJoinAndSelect('center.phones', 'phone')
      .leftJoinAndSelect('center.specialties', 'specialty')
      .leftJoinAndSelect('center.paymentMethods', 'method')
      .leftJoinAndSelect('center.servicePrices', 'sp')
      .leftJoinAndSelect('sp.serviceType', 'spST')
      .orderBy(`center.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('center.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(center.businessName) LIKE :s OR LOWER(center.email) LIKE :s OR LOWER(center.rif) LIKE :s)',
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('center.isActive = :a', { a: isActive === 'true' });
    }

    if (specialtyId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM care_centers_specialties cs WHERE cs."careCenterId" = center.id AND cs."specialtyId" = :sid)',
        { sid: specialtyId },
      );
    }

    return paginateBuilder<CareCenter>(qb, page, limit);
  }

  async findAssignable(): Promise<CareCenter[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { businessName: 'ASC' },
    });
  }

  async findOne(id: string, withDeleted = false): Promise<CareCenter> {
    const center = await this.repo.findOne({
      where: { id },
      relations: {
        phones: true,
        specialties: true,
        paymentMethods: true,
        servicePrices: { serviceType: true },
      },
      withDeleted,
    });
    if (!center) throw new NotFoundException('Centro de atención no encontrado');
    return center;
  }

  async create(dto: CreateCareCenterDto): Promise<CareCenter> {
    const businessName = dto.businessName.trim();
    const email = dto.email ? dto.email.toLowerCase().trim() : null;
    const rif = dto.rif ? normalizeRif(dto.rif) : null;

    await this.assertUniqueBusinessName(businessName);
    if (email) await this.assertUniqueEmail(email);
    if (rif) await this.assertUniqueRif(rif);

    const specialties = await this.resolveSpecialties(dto.specialtyIds);
    await this.validatePaymentMethods(dto.paymentMethods ?? []);
    await this.validateServicePrices(dto.servicePrices ?? []);

    const center = this.repo.create({
      businessName,
      email,
      rif,
      isActive: dto.isActive ?? true,
      specialties,
      phones: dto.phones.map((p) => this.phonesRepo.create(this.phonePayload(p))),
      paymentMethods: (dto.paymentMethods ?? []).map((m) =>
        this.methodsRepo.create(this.methodPayload(m)),
      ),
    });
    const saved = await this.repo.save(center);

    if (dto.servicePrices?.length) {
      await this.pricesRepo.insert(
        dto.servicePrices.map((sp) => ({
          careCenterId: saved.id,
          serviceTypeId: sp.serviceTypeId,
          priceUsd: sp.priceUsd.toFixed(2),
          priceEur: sp.priceEur.toFixed(2),
        })),
      );
    }
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateCareCenterDto): Promise<CareCenter> {
    const center = await this.findOne(id);

    if (dto.businessName) {
      const businessName = dto.businessName.trim();
      if (businessName !== center.businessName) {
        await this.assertUniqueBusinessName(businessName);
        center.businessName = businessName;
      }
    }
    if (dto.email !== undefined) {
      const trimmed = dto.email ? dto.email.toLowerCase().trim() : null;
      if (trimmed !== center.email) {
        if (trimmed) await this.assertUniqueEmail(trimmed);
        center.email = trimmed;
      }
    }
    if (dto.rif !== undefined) {
      const next = dto.rif ? normalizeRif(dto.rif) : null;
      if (next !== center.rif) {
        if (next) await this.assertUniqueRif(next);
        center.rif = next;
      }
    }
    if (dto.isActive !== undefined) center.isActive = dto.isActive;

    if (dto.specialtyIds) {
      center.specialties = await this.resolveSpecialties(dto.specialtyIds);
    }

    if (dto.phones) {
      await this.phonesRepo.delete({ careCenterId: center.id });
      center.phones = dto.phones.map((p) =>
        this.phonesRepo.create({ ...this.phonePayload(p), careCenterId: center.id }),
      );
    }

    if (dto.paymentMethods) {
      await this.validatePaymentMethods(dto.paymentMethods);
      await this.methodsRepo.delete({ careCenterId: center.id });
      center.paymentMethods = dto.paymentMethods.map((m) =>
        this.methodsRepo.create({ ...this.methodPayload(m), careCenterId: center.id }),
      );
    }

    const saved = await this.repo.save(center);

    if (dto.servicePrices !== undefined) {
      await this.validateServicePrices(dto.servicePrices);
      await this.pricesRepo.delete({ careCenterId: saved.id });
      if (dto.servicePrices.length) {
        await this.pricesRepo.insert(
          dto.servicePrices.map((sp) => ({
            careCenterId: saved.id,
            serviceTypeId: sp.serviceTypeId,
            priceUsd: sp.priceUsd.toFixed(2),
            priceEur: sp.priceEur.toFixed(2),
          })),
        );
      }
    }

    return this.findOne(saved.id);
  }

  private async validateServicePrices(prices: ServicePriceDto[]): Promise<void> {
    if (!prices.length) return;
    const ids = prices.map((p) => p.serviceTypeId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'No pueden repetirse tipos de servicio en los precios',
      );
    }
    const found = await this.serviceTypesRepo.find({
      where: { id: In(ids), deletedAt: IsNull() },
      select: ['id', 'isActive'],
    });
    if (found.length !== ids.length || found.some((s) => !s.isActive)) {
      throw new BadRequestException(
        'Algún tipo de servicio en los precios no existe o está deshabilitado',
      );
    }
  }

  async toggleActive(id: string): Promise<CareCenter> {
    const center = await this.findOne(id);
    center.isActive = !center.isActive;
    return this.repo.save(center);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<CareCenter> {
    const center = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!center) throw new NotFoundException('Centro de atención no encontrado');
    if (!center.deletedAt) return center;
    await this.repo.restore(id);
    return this.findOne(id);
  }

  // ---- helpers ----

  private phonePayload(p: PhoneDto) {
    return { number: p.number, label: p.label ?? null };
  }

  private methodPayload(m: PaymentMethodDto) {
    return {
      type: m.type,
      isActive: m.isActive ?? true,
      bankCode: m.bankCode ?? null,
      phoneNumber: m.phoneNumber ?? null,
      idDocument: m.idDocument ?? null,
      accountNumber: m.accountNumber ?? null,
      accountHolderName: m.accountHolderName ?? null,
      description: m.description ?? null,
    };
  }

  private async resolveSpecialties(ids: string[]): Promise<Specialty[]> {
    if (!ids.length) {
      throw new BadRequestException('Debe asignar al menos una especialidad');
    }
    const specialties = await this.specialtiesRepo.find({ where: { id: In(ids) } });
    if (specialties.length !== ids.length) {
      throw new BadRequestException('Algunas especialidades no existen');
    }
    return specialties;
  }

  private async validatePaymentMethods(methods: PaymentMethodDto[]): Promise<void> {
    const codes = methods
      .filter((m) => m.type === 'mobile_payment' && m.bankCode)
      .map((m) => m.bankCode!);
    if (!codes.length) return;
    const banks = await this.banksRepo.find({ where: { code: In(codes) } });
    const found = new Set(banks.map((b) => b.code));
    for (const c of codes) {
      if (!found.has(c)) {
        throw new BadRequestException(`Banco con código ${c} no existe`);
      }
    }
  }

  private async assertUniqueBusinessName(businessName: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { businessName }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un centro con esa razón social');
  }

  private async assertUniqueEmail(email: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { email }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un centro con ese email');
  }

  private async assertUniqueRif(rif: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { rif }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un centro con ese RIF');
  }
}
