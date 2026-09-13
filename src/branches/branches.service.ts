import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly repo: Repository<Branch>,
  ) {}

  async findAll(query: QueryBranchesDto): Promise<PaginatedResponse<Branch>> {
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
      .createQueryBuilder('branch')
      .orderBy(`branch.${sortBy}`, sortDir);

    if (onlyDeleted === 'true') {
      qb.withDeleted().andWhere('branch.deletedAt IS NOT NULL');
    } else if (withDeleted === 'true') {
      qb.withDeleted();
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(LOWER(branch.name) LIKE :s OR LOWER(branch.description) LIKE :s)',
        { s: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('branch.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<Branch>(qb, page, limit);
  }

  /** Solo activas + no eliminadas, ordenadas por nombre. */
  async findAssignable(): Promise<Branch[]> {
    return this.repo.find({
      where: { isActive: true, deletedAt: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, withDeleted = false): Promise<Branch> {
    const branch = await this.repo.findOne({ where: { id }, withDeleted });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  async create(dto: CreateBranchDto): Promise<Branch> {
    const name = dto.name.trim();
    const exists = await this.repo.findOne({
      where: { name },
      withDeleted: true,
    });
    if (exists)
      throw new ConflictException('Ya existe una sucursal con ese nombre');
    const branch = this.repo.create({
      name,
      description: dto.description?.trim() ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(branch);
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findOne(id);
    if (dto.name) {
      const name = dto.name.trim();
      if (name !== branch.name) {
        const dupe = await this.repo.findOne({
          where: { name },
          withDeleted: true,
        });
        if (dupe)
          throw new ConflictException('Ya existe una sucursal con ese nombre');
        branch.name = name;
      }
    }
    if (dto.description !== undefined) {
      branch.description = dto.description?.trim() ?? null;
    }
    if (dto.isActive !== undefined) branch.isActive = dto.isActive;
    return this.repo.save(branch);
  }

  async toggleActive(id: string): Promise<Branch> {
    const branch = await this.findOne(id);
    branch.isActive = !branch.isActive;
    return this.repo.save(branch);
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    await this.findOne(id, true);
    await this.repo.delete(id);
  }

  async restore(id: string): Promise<Branch> {
    const branch = await this.repo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    if (!branch.deletedAt) return branch;
    await this.repo.restore(id);
    return this.findOne(id);
  }
}
