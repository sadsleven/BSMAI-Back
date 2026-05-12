import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insurance } from './entities/insurance.entity';
import { InsurancePhone } from './entities/insurance-phone.entity';
import { CreateInsuranceDto } from './dto/create-insurance.dto';
import { UpdateInsuranceDto } from './dto/update-insurance.dto';
import { QueryInsurancesDto } from './dto/query-insurances.dto';
import { PhoneDto } from './dto/phone.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class InsurancesService {
  constructor(
    @InjectRepository(Insurance) private readonly repo: Repository<Insurance>,
    @InjectRepository(InsurancePhone)
    private readonly phonesRepo: Repository<InsurancePhone>,
  ) {}

  async findAll(query: QueryInsurancesDto): Promise<PaginatedResponse<Insurance>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
      isActive,
    } = query;

    const qb = this.repo
      .createQueryBuilder('insurance')
      .leftJoinAndSelect('insurance.phones', 'phone')
      .orderBy(`insurance.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('insurance.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(insurance.name) LIKE :s OR LOWER(insurance.description) LIKE :s OR LOWER(insurance.email) LIKE :s)',
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('insurance.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<Insurance>(qb, page, limit);
  }

  async findAssignable(): Promise<Insurance[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, withDeleted = false): Promise<Insurance> {
    const insurance = await this.repo.findOne({
      where: { id },
      relations: { phones: true },
      withDeleted,
    });
    if (!insurance) throw new NotFoundException('Seguro no encontrado');
    return insurance;
  }

  async create(dto: CreateInsuranceDto): Promise<Insurance> {
    await this.assertUniqueName(dto.name.trim());
    const email = dto.email ? dto.email.toLowerCase().trim() : null;
    if (email) await this.assertUniqueEmail(email);
    const insurance = this.repo.create({
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      email,
      fiscalAddress: dto.fiscalAddress?.trim() || null,
      isActive: dto.isActive ?? true,
      phones: (dto.phones ?? []).map((p) =>
        this.phonesRepo.create(this.phonePayload(p)),
      ),
    });
    return this.repo.save(insurance);
  }

  async update(id: string, dto: UpdateInsuranceDto): Promise<Insurance> {
    const insurance = await this.findOne(id);

    if (dto.name) {
      const name = dto.name.trim();
      if (name !== insurance.name) {
        await this.assertUniqueName(name);
        insurance.name = name;
      }
    }
    if (dto.description !== undefined)
      insurance.description = dto.description?.trim() ?? null;
    if (dto.email !== undefined) {
      const trimmed = dto.email ? dto.email.toLowerCase().trim() : null;
      if (trimmed !== insurance.email) {
        if (trimmed) await this.assertUniqueEmail(trimmed);
        insurance.email = trimmed;
      }
    }
    if (dto.fiscalAddress !== undefined) {
      insurance.fiscalAddress = dto.fiscalAddress?.trim() || null;
    }
    if (dto.isActive !== undefined) insurance.isActive = dto.isActive;

    if (dto.phones) {
      await this.phonesRepo.delete({ insuranceId: insurance.id });
      insurance.phones = dto.phones.map((p) =>
        this.phonesRepo.create({
          ...this.phonePayload(p),
          insuranceId: insurance.id,
        }),
      );
    }

    return this.repo.save(insurance);
  }

  async toggleActive(id: string): Promise<Insurance> {
    const insurance = await this.findOne(id);
    insurance.isActive = !insurance.isActive;
    return this.repo.save(insurance);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<Insurance> {
    const insurance = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!insurance) throw new NotFoundException('Seguro no encontrado');
    if (!insurance.deletedAt) return insurance;
    await this.repo.restore(id);
    return this.findOne(id);
  }

  private phonePayload(p: PhoneDto) {
    return { number: p.number, label: p.label ?? null };
  }

  private async assertUniqueName(name: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { name }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un seguro con ese nombre');
  }

  private async assertUniqueEmail(email: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { email }, withDeleted: true });
    if (existing) throw new ConflictException('Ya existe un seguro con ese email');
  }
}
