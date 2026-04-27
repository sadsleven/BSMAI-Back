import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CareCenter } from './entities/care-center.entity';
import { CareCenterPhone } from './entities/care-center-phone.entity';
import { CareCenterPaymentMethod } from './entities/care-center-payment-method.entity';
import { Specialty } from '../specialties/entities/specialty.entity';
import { Bank } from '../banks/entities/bank.entity';
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
      .orderBy(`center.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('center.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(center.name) LIKE :s OR LOWER(center.email) LIKE :s OR LOWER(center.rif) LIKE :s)',
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

  async findOne(id: string, withDeleted = false): Promise<CareCenter> {
    const center = await this.repo.findOne({
      where: { id },
      relations: { phones: true, specialties: true, paymentMethods: true },
      withDeleted,
    });
    if (!center) throw new NotFoundException('Centro de atención no encontrado');
    return center;
  }

  async create(dto: CreateCareCenterDto): Promise<CareCenter> {
    const name = dto.name.trim();
    const email = dto.email.toLowerCase().trim();
    const rif = normalizeRif(dto.rif);

    await this.assertUniqueName(name);
    await this.assertUniqueEmail(email);
    await this.assertUniqueRif(rif);

    const specialties = await this.resolveSpecialties(dto.specialtyIds);
    await this.validatePaymentMethods(dto.paymentMethods ?? []);

    const center = this.repo.create({
      name,
      email,
      rif,
      isActive: dto.isActive ?? true,
      specialties,
      phones: dto.phones.map((p) => this.phonesRepo.create(this.phonePayload(p))),
      paymentMethods: (dto.paymentMethods ?? []).map((m) =>
        this.methodsRepo.create(this.methodPayload(m)),
      ),
    });
    return this.repo.save(center);
  }

  async update(id: string, dto: UpdateCareCenterDto): Promise<CareCenter> {
    const center = await this.findOne(id);

    if (dto.name) {
      const name = dto.name.trim();
      if (name !== center.name) {
        await this.assertUniqueName(name);
        center.name = name;
      }
    }
    if (dto.email) {
      const email = dto.email.toLowerCase().trim();
      if (email !== center.email) {
        await this.assertUniqueEmail(email);
        center.email = email;
      }
    }
    if (dto.rif) {
      const rif = normalizeRif(dto.rif);
      if (rif !== center.rif) {
        await this.assertUniqueRif(rif);
        center.rif = rif;
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

    return this.repo.save(center);
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

  private async assertUniqueName(name: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { name }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un centro con ese nombre');
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
