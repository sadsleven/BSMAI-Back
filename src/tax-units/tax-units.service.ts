import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { TaxUnit } from './entities/tax-unit.entity';
import { CreateTaxUnitDto } from './dto/create-tax-unit.dto';
import { UpdateTaxUnitDto } from './dto/update-tax-unit.dto';
import { QueryTaxUnitsDto } from './dto/query-tax-units.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class TaxUnitsService {
  constructor(
    @InjectRepository(TaxUnit) private readonly repo: Repository<TaxUnit>,
  ) {}

  async findAll(query: QueryTaxUnitsDto): Promise<PaginatedResponse<TaxUnit>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'effectiveDate',
      sortDir = 'DESC',
      withDeleted,
      onlyDeleted,
      isActive,
      effectiveDateFrom,
      effectiveDateTo,
    } = query;

    const qb = this.repo.createQueryBuilder('ut').orderBy(`ut.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('ut.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (effectiveDateFrom) qb.andWhere('ut.effectiveDate >= :df', { df: effectiveDateFrom });
    if (effectiveDateTo) qb.andWhere('ut.effectiveDate <= :dt', { dt: effectiveDateTo });
    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('ut.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<TaxUnit>(qb, page, limit);
  }

  /**
   * UT vigente: la más reciente con `effectiveDate <= hoy`, activa y no
   * borrada. Si no hay ninguna válida hoy, devuelve null.
   */
  async findCurrent(referenceDate?: string): Promise<TaxUnit | null> {
    const today = referenceDate ?? new Date().toISOString().slice(0, 10);
    const ut = await this.repo.findOne({
      where: {
        isActive: true,
        deletedAt: IsNull(),
        effectiveDate: LessThanOrEqual(today),
      },
      order: { effectiveDate: 'DESC', createdAt: 'DESC' },
    });
    return ut ?? null;
  }

  async getCurrentOrThrow(referenceDate?: string): Promise<TaxUnit> {
    const ut = await this.findCurrent(referenceDate);
    if (!ut) {
      throw new BadRequestException(
        'No hay Unidad Tributaria vigente. Cargá una en /tax-units antes de continuar.',
      );
    }
    return ut;
  }

  async findOne(id: string, withDeleted = false): Promise<TaxUnit> {
    const ut = await this.repo.findOne({ where: { id }, withDeleted });
    if (!ut) throw new NotFoundException('Unidad Tributaria no encontrada');
    return ut;
  }

  async create(dto: CreateTaxUnitDto): Promise<TaxUnit> {
    const ut = this.repo.create({
      amountBs: dto.amountBs.toFixed(2),
      effectiveDate: dto.effectiveDate,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(ut);
  }

  async update(id: string, dto: UpdateTaxUnitDto): Promise<TaxUnit> {
    const ut = await this.findOne(id);
    if (dto.amountBs !== undefined) ut.amountBs = dto.amountBs.toFixed(2);
    if (dto.effectiveDate !== undefined) ut.effectiveDate = dto.effectiveDate;
    if (dto.isActive !== undefined) ut.isActive = dto.isActive;
    return this.repo.save(ut);
  }

  async toggleActive(id: string): Promise<TaxUnit> {
    const ut = await this.findOne(id);
    ut.isActive = !ut.isActive;
    return this.repo.save(ut);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<TaxUnit> {
    const ut = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!ut) throw new NotFoundException('Unidad Tributaria no encontrada');
    if (!ut.deletedAt) return ut;
    await this.repo.restore(id);
    return this.findOne(id);
  }
}
