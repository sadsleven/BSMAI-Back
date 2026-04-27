import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pathology } from './entities/pathology.entity';
import { CreatePathologyDto } from './dto/create-pathology.dto';
import { UpdatePathologyDto } from './dto/update-pathology.dto';
import { QueryPathologiesDto } from './dto/query-pathologies.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class PathologiesService {
  constructor(
    @InjectRepository(Pathology) private readonly repo: Repository<Pathology>,
  ) {}

  async findAll(query: QueryPathologiesDto): Promise<PaginatedResponse<Pathology>> {
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

    const qb = this.repo.createQueryBuilder('pathology').orderBy(`pathology.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('pathology.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(pathology.name) LIKE :s OR LOWER(pathology.description) LIKE :s)',
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('pathology.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<Pathology>(qb, page, limit);
  }

  async findAssignable(): Promise<Pathology[]> {
    return this.repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOne(id: string, withDeleted = false): Promise<Pathology> {
    const pathology = await this.repo.findOne({ where: { id }, withDeleted });
    if (!pathology) throw new NotFoundException('Patología no encontrada');
    return pathology;
  }

  async create(dto: CreatePathologyDto): Promise<Pathology> {
    const exists = await this.repo.findOne({ where: { name: dto.name }, withDeleted: true });
    if (exists) throw new ConflictException('Ya existe una patología con ese nombre');
    const pathology = this.repo.create({
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(pathology);
  }

  async update(id: string, dto: UpdatePathologyDto): Promise<Pathology> {
    const pathology = await this.findOne(id);
    if (dto.name && dto.name !== pathology.name) {
      const dupe = await this.repo.findOne({ where: { name: dto.name }, withDeleted: true });
      if (dupe) throw new ConflictException('Ya existe una patología con ese nombre');
      pathology.name = dto.name;
    }
    if (dto.description !== undefined) pathology.description = dto.description ?? null;
    if (dto.isActive !== undefined) pathology.isActive = dto.isActive;
    return this.repo.save(pathology);
  }

  async toggleActive(id: string): Promise<Pathology> {
    const pathology = await this.findOne(id);
    pathology.isActive = !pathology.isActive;
    return this.repo.save(pathology);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<Pathology> {
    const pathology = await this.repo.findOne({ where: { id }, withDeleted: true });
    if (!pathology) throw new NotFoundException('Patología no encontrada');
    if (!pathology.deletedAt) return pathology;
    await this.repo.restore(id);
    return this.findOne(id);
  }
}
