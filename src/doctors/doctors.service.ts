import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Doctor } from './entities/doctor.entity';
import { DoctorPhone } from './entities/doctor-phone.entity';
import { DoctorPaymentMethod } from './entities/doctor-payment-method.entity';
import { DoctorServicePrice } from './entities/doctor-service-price.entity';
import { Specialty } from '../specialties/entities/specialty.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { ServicePriceDto } from '../shared/dto/service-price.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { QueryDoctorsDto } from './dto/query-doctors.dto';
import { PhoneDto } from './dto/phone.dto';
import { PaymentMethodDto } from './dto/payment-method.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import {
  normalizeCedula,
  normalizeRif,
} from '../shared/validators/ve-formats';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor) private readonly repo: Repository<Doctor>,
    @InjectRepository(DoctorPhone)
    private readonly phonesRepo: Repository<DoctorPhone>,
    @InjectRepository(DoctorPaymentMethod)
    private readonly methodsRepo: Repository<DoctorPaymentMethod>,
    @InjectRepository(Specialty)
    private readonly specialtiesRepo: Repository<Specialty>,
    @InjectRepository(Bank) private readonly banksRepo: Repository<Bank>,
    @InjectRepository(DoctorServicePrice)
    private readonly pricesRepo: Repository<DoctorServicePrice>,
    @InjectRepository(ServiceType)
    private readonly serviceTypesRepo: Repository<ServiceType>,
  ) {}

  async findAll(query: QueryDoctorsDto): Promise<PaginatedResponse<Doctor>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
      isActive,
      entityType,
      specialtyId,
    } = query;

    const qb = this.repo
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.phones', 'phone')
      .leftJoinAndSelect('doctor.specialties', 'specialty')
      .leftJoinAndSelect('doctor.paymentMethods', 'method')
      .leftJoinAndSelect('doctor.servicePrices', 'sp')
      .leftJoinAndSelect('sp.serviceType', 'spST')
      .orderBy(`doctor.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('doctor.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(doctor.firstName) LIKE :s OR LOWER(doctor.lastName) LIKE :s OR LOWER(doctor.email) LIKE :s OR LOWER(doctor.cedula) LIKE :s OR LOWER(doctor.rif) LIKE :s)',
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('doctor.isActive = :a', { a: isActive === 'true' });
    }

    if (entityType === 'legal') qb.andWhere('doctor.isLegalEntity = true');
    else if (entityType === 'natural') qb.andWhere('doctor.isLegalEntity = false');

    if (specialtyId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM doctors_specialties ds WHERE ds."doctorId" = doctor.id AND ds."specialtyId" = :sid)',
        { sid: specialtyId },
      );
    }

    return paginateBuilder<Doctor>(qb, page, limit);
  }

  async findAssignable(): Promise<Doctor[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
  }

  async findOne(id: string, withDeleted = false): Promise<Doctor> {
    const doctor = await this.repo.findOne({
      where: { id },
      relations: {
        phones: true,
        specialties: true,
        paymentMethods: true,
        servicePrices: { serviceType: true },
      },
      withDeleted,
    });
    if (!doctor) throw new NotFoundException('Doctor no encontrado');
    return doctor;
  }

  async create(dto: CreateDoctorDto): Promise<Doctor> {
    const cedula = normalizeCedula(dto.cedula);
    const email = dto.email ? dto.email.toLowerCase().trim() : null;
    const isLegal = dto.isLegalEntity ?? false;
    const rif = isLegal && dto.rif ? normalizeRif(dto.rif) : null;

    if (isLegal && !rif) {
      throw new BadRequestException(
        'El RIF es obligatorio cuando el doctor es persona jurídica',
      );
    }
    if (!isLegal && dto.rif) {
      throw new BadRequestException(
        'No se puede asignar RIF a un doctor que no es persona jurídica',
      );
    }

    await this.assertUniqueCedula(cedula);
    if (email) await this.assertUniqueEmail(email);
    if (rif) await this.assertUniqueRif(rif);

    const specialties = await this.resolveSpecialties(dto.specialtyIds);
    await this.validatePaymentMethods(dto.paymentMethods ?? []);
    await this.validateServicePrices(dto.servicePrices ?? []);

    const doctor = this.repo.create({
      cedula,
      email,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      isLegalEntity: isLegal,
      rif,
      isActive: dto.isActive ?? true,
      specialties,
      phones: dto.phones.map((p) => this.phonesRepo.create(this.phonePayload(p))),
      paymentMethods: (dto.paymentMethods ?? []).map((m) =>
        this.methodsRepo.create(this.methodPayload(m)),
      ),
    });
    const saved = await this.repo.save(doctor);

    if (dto.servicePrices?.length) {
      await this.pricesRepo.insert(
        dto.servicePrices.map((sp) => ({
          doctorId: saved.id,
          serviceTypeId: sp.serviceTypeId,
          priceUsd: sp.priceUsd.toFixed(2),
          priceEur: sp.priceEur.toFixed(2),
        })),
      );
    }
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateDoctorDto): Promise<Doctor> {
    const doctor = await this.findOne(id);

    if (dto.cedula) {
      const cedula = normalizeCedula(dto.cedula);
      if (cedula !== doctor.cedula) {
        await this.assertUniqueCedula(cedula);
        doctor.cedula = cedula;
      }
    }
    if (dto.email !== undefined) {
      const trimmed = dto.email ? dto.email.toLowerCase().trim() : null;
      if (trimmed !== doctor.email) {
        if (trimmed) await this.assertUniqueEmail(trimmed);
        doctor.email = trimmed;
      }
    }
    if (dto.firstName !== undefined) doctor.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) doctor.lastName = dto.lastName.trim();
    if (dto.isActive !== undefined) doctor.isActive = dto.isActive;

    // isLegalEntity / rif coupled rules
    const nextLegal = dto.isLegalEntity ?? doctor.isLegalEntity;
    const nextRif = dto.rif !== undefined ? (dto.rif ? normalizeRif(dto.rif) : null) : doctor.rif;
    if (nextLegal && !nextRif) {
      throw new BadRequestException(
        'El RIF es obligatorio cuando el doctor es persona jurídica',
      );
    }
    if (!nextLegal && nextRif) {
      throw new BadRequestException(
        'No se puede asignar RIF a un doctor que no es persona jurídica',
      );
    }
    if (nextRif && nextRif !== doctor.rif) {
      await this.assertUniqueRif(nextRif);
    }
    doctor.isLegalEntity = nextLegal;
    doctor.rif = nextLegal ? nextRif : null;

    if (dto.specialtyIds) {
      doctor.specialties = await this.resolveSpecialties(dto.specialtyIds);
    }

    if (dto.phones) {
      await this.phonesRepo.delete({ doctorId: doctor.id });
      doctor.phones = dto.phones.map((p) =>
        this.phonesRepo.create({ ...this.phonePayload(p), doctorId: doctor.id }),
      );
    }

    if (dto.paymentMethods) {
      await this.validatePaymentMethods(dto.paymentMethods);
      await this.methodsRepo.delete({ doctorId: doctor.id });
      doctor.paymentMethods = dto.paymentMethods.map((m) =>
        this.methodsRepo.create({ ...this.methodPayload(m), doctorId: doctor.id }),
      );
    }

    const saved = await this.repo.save(doctor);

    if (dto.servicePrices !== undefined) {
      await this.validateServicePrices(dto.servicePrices);
      await this.pricesRepo.delete({ doctorId: saved.id });
      if (dto.servicePrices.length) {
        await this.pricesRepo.insert(
          dto.servicePrices.map((sp) => ({
            doctorId: saved.id,
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

  async toggleActive(id: string): Promise<Doctor> {
    const doctor = await this.findOne(id);
    doctor.isActive = !doctor.isActive;
    return this.repo.save(doctor);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<Doctor> {
    const doctor = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!doctor) throw new NotFoundException('Doctor no encontrado');
    if (!doctor.deletedAt) return doctor;
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

  private async assertUniqueCedula(cedula: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { cedula }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un doctor con esa cédula');
  }

  private async assertUniqueEmail(email: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { email }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un doctor con ese email');
  }

  private async assertUniqueRif(rif: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { rif }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un doctor con ese RIF');
  }
}
