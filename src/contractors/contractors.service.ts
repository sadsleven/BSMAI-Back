import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Contractor } from './entities/contractor.entity';
import { Insurance } from '../insurances/entities/insurance.entity';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';
import { QueryContractorsDto } from './dto/query-contractors.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class ContractorsService {
  constructor(
    @InjectRepository(Contractor) private readonly repo: Repository<Contractor>,
    @InjectRepository(Insurance) private readonly insurancesRepo: Repository<Insurance>,
  ) {}

  async findAll(query: QueryContractorsDto): Promise<PaginatedResponse<Contractor>> {
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
      .createQueryBuilder('contractor')
      .leftJoinAndSelect('contractor.insurances', 'insurance')
      .orderBy(`contractor.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('contractor.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(contractor.name) LIKE :s OR LOWER(contractor.description) LIKE :s)',
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('contractor.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<Contractor>(qb, page, limit);
  }

  async findAssignable(): Promise<Contractor[]> {
    // relationLoadStrategy:'query' → carga insurances (y su eager phones/
    // servicePrices) en SELECTs separados; evita el producto cartesiano
    // contractors × insurances × insurance.servicePrices sin paginar.
    return this.repo.find({
      where: { isActive: true },
      relations: { insurances: true },
      order: { name: 'ASC' },
      relationLoadStrategy: 'query',
    });
  }

  async findOne(id: string, withDeleted = false): Promise<Contractor> {
    const contractor = await this.repo.findOne({
      where: { id },
      relations: { insurances: true },
      withDeleted,
    });
    if (!contractor) throw new NotFoundException('Contratista no encontrado');
    return contractor;
  }

  async create(dto: CreateContractorDto): Promise<Contractor> {
    const name = dto.name.trim();
    const exists = await this.repo.findOne({ where: { name }, withDeleted: true });
    if (exists) throw new ConflictException('Ya existe un contratista con ese nombre');
    const insurances = await this.resolveInsurances(dto.insuranceIds ?? []);
    const contractor = this.repo.create({
      name,
      description: dto.description?.trim() ?? null,
      isActive: dto.isActive ?? true,
      insurances,
    });
    return this.repo.save(contractor);
  }

  async update(id: string, dto: UpdateContractorDto): Promise<Contractor> {
    const contractor = await this.findOne(id);
    if (dto.name) {
      const name = dto.name.trim();
      if (name !== contractor.name) {
        const dupe = await this.repo.findOne({ where: { name }, withDeleted: true });
        if (dupe) throw new ConflictException('Ya existe un contratista con ese nombre');
        contractor.name = name;
      }
    }
    if (dto.description !== undefined) {
      contractor.description = dto.description?.trim() ?? null;
    }
    if (dto.isActive !== undefined) contractor.isActive = dto.isActive;

    if (dto.insuranceIds !== undefined) {
      contractor.insurances = await this.resolveInsurances(
        dto.insuranceIds,
        contractor.insurances ?? [],
      );
    }
    return this.repo.save(contractor);
  }

  async toggleActive(id: string): Promise<Contractor> {
    const contractor = await this.findOne(id);
    contractor.isActive = !contractor.isActive;
    return this.repo.save(contractor);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<Contractor> {
    const contractor = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!contractor) throw new NotFoundException('Contratista no encontrado');
    if (!contractor.deletedAt) return contractor;
    await this.repo.restore(id);
    return this.findOne(id);
  }

  /** Nuevos IDs deben estar activos+no eliminados; los stale ya asignados se mantienen. */
  private async resolveInsurances(
    ids: string[],
    current: Insurance[] = [],
  ): Promise<Insurance[]> {
    if (!ids.length) return [];
    const unique = Array.from(new Set(ids));
    const currentIds = new Set(current.map((i) => i.id));
    const newIds = unique.filter((id) => !currentIds.has(id));

    if (newIds.length) {
      const valid = await this.insurancesRepo.find({
        where: { id: In(newIds), isActive: true, deletedAt: IsNull() },
      });
      if (valid.length !== newIds.length) {
        const validIds = new Set(valid.map((v) => v.id));
        const missing = newIds.filter((id) => !validIds.has(id));
        throw new BadRequestException(
          `Algunos seguros no existen, están deshabilitados o en papelera: ${missing.join(', ')}`,
        );
      }
    }

    const entities = await this.insurancesRepo.find({
      where: { id: In(unique) },
      withDeleted: true,
    });
    return entities;
  }
}
