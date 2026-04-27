import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specialty } from './entities/specialty.entity';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';
import { QuerySpecialtiesDto } from './dto/query-specialties.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class SpecialtiesService {
  constructor(
    @InjectRepository(Specialty) private readonly repo: Repository<Specialty>,
  ) {}

  async findAll(query: QuerySpecialtiesDto): Promise<PaginatedResponse<Specialty>> {
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

    const qb = this.repo.createQueryBuilder('specialty').orderBy(`specialty.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('specialty.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(specialty.name) LIKE :s OR LOWER(specialty.description) LIKE :s)',
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('specialty.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<Specialty>(qb, page, limit);
  }

  async findAssignable(): Promise<Specialty[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, withDeleted = false): Promise<Specialty> {
    const specialty = await this.repo.findOne({ where: { id }, withDeleted });
    if (!specialty) throw new NotFoundException('Especialidad no encontrada');
    return specialty;
  }

  async create(dto: CreateSpecialtyDto): Promise<Specialty> {
    const exists = await this.repo.findOne({
      where: { name: dto.name },
      withDeleted: true,
    });
    if (exists) throw new ConflictException('Ya existe una especialidad con ese nombre');
    const specialty = this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(specialty);
  }

  async update(id: string, dto: UpdateSpecialtyDto): Promise<Specialty> {
    const specialty = await this.findOne(id);
    if (dto.name && dto.name !== specialty.name) {
      const dupe = await this.repo.findOne({
        where: { name: dto.name },
        withDeleted: true,
      });
      if (dupe) throw new ConflictException('Ya existe una especialidad con ese nombre');
      specialty.name = dto.name;
    }
    if (dto.description !== undefined) specialty.description = dto.description ?? null;
    if (dto.isActive !== undefined) specialty.isActive = dto.isActive;
    return this.repo.save(specialty);
  }

  async toggleActive(id: string): Promise<Specialty> {
    const specialty = await this.findOne(id);
    specialty.isActive = !specialty.isActive;
    return this.repo.save(specialty);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<Specialty> {
    const specialty = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!specialty) throw new NotFoundException('Especialidad no encontrada');
    if (!specialty.deletedAt) return specialty;
    await this.repo.restore(id);
    return this.findOne(id);
  }
}
