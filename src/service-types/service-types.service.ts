import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceType } from './entities/service-type.entity';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { UpdateServiceTypeDto } from './dto/update-service-type.dto';
import { QueryServiceTypesDto } from './dto/query-service-types.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class ServiceTypesService {
  constructor(
    @InjectRepository(ServiceType) private readonly repo: Repository<ServiceType>,
  ) {}

  async findAll(query: QueryServiceTypesDto): Promise<PaginatedResponse<ServiceType>> {
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

    const qb = this.repo.createQueryBuilder('st').orderBy(`st.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('st.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere('(LOWER(st.name) LIKE :s OR LOWER(st.description) LIKE :s)', {
        s: `%${search.trim().toLowerCase()}%`,
      });
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('st.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<ServiceType>(qb, page, limit);
  }

  async findAssignable(): Promise<ServiceType[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, withDeleted = false): Promise<ServiceType> {
    const st = await this.repo.findOne({ where: { id }, withDeleted });
    if (!st) throw new NotFoundException('Tipo de servicio no encontrado');
    return st;
  }

  async create(dto: CreateServiceTypeDto): Promise<ServiceType> {
    const exists = await this.repo.findOne({ where: { name: dto.name }, withDeleted: true });
    if (exists) throw new ConflictException('Ya existe un tipo de servicio con ese nombre');

    const st = this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      particularPriceUsd:
        dto.particularPriceUsd != null ? dto.particularPriceUsd.toFixed(2) : null,
    });
    return this.repo.save(st);
  }

  async update(id: string, dto: UpdateServiceTypeDto): Promise<ServiceType> {
    const st = await this.findOne(id);
    if (dto.name && dto.name !== st.name) {
      const dupe = await this.repo.findOne({ where: { name: dto.name }, withDeleted: true });
      if (dupe) throw new ConflictException('Ya existe un tipo de servicio con ese nombre');
      st.name = dto.name;
    }
    if (dto.description !== undefined) st.description = dto.description ?? null;
    if (dto.isActive !== undefined) st.isActive = dto.isActive;
    if (dto.particularPriceUsd !== undefined)
      st.particularPriceUsd =
        dto.particularPriceUsd != null ? dto.particularPriceUsd.toFixed(2) : null;
    return this.repo.save(st);
  }

  async toggleActive(id: string): Promise<ServiceType> {
    const st = await this.findOne(id);
    st.isActive = !st.isActive;
    return this.repo.save(st);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<ServiceType> {
    const st = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!st) throw new NotFoundException('Tipo de servicio no encontrado');
    if (!st.deletedAt) return this.findOne(id);
    await this.repo.restore(id);
    return this.findOne(id);
  }
}
