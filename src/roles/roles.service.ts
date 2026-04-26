import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { QueryRolesDto } from './dto/query-roles.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';

function ensureNotSystem(role: Role, action: string): void {
  if (role.isSystem) {
    throw new ForbiddenException(
      `No se puede ${action} un rol del sistema`,
    );
  }
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionsRepo: Repository<Permission>,
  ) {}

  async findAll(query: QueryRolesDto): Promise<PaginatedResponse<Role>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
      origin,
      isActive,
    } = query;
    const qb = this.rolesRepo
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .orderBy(`role.${sortBy}`, sortDir);

    if (withDeleted === 'true') qb.withDeleted();

    if (search && search.trim()) {
      qb.andWhere('(LOWER(role.name) LIKE :s OR LOWER(role.description) LIKE :s)', {
        s: `%${search.trim().toLowerCase()}%`,
      });
    }

    if (origin === 'system') qb.andWhere('role.isSystem = true');
    else if (origin === 'custom') qb.andWhere('role.isSystem = false');

    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('role.isActive = :a', { a: isActive === 'true' });
    }

    return paginateBuilder<Role>(qb, page, limit);
  }

  async findAssignable(): Promise<Role[]> {
    return this.rolesRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async toggleActive(id: string): Promise<Role> {
    const role = await this.findOne(id);
    ensureNotSystem(role, 'deshabilitar');
    role.isActive = !role.isActive;
    return this.rolesRepo.save(role);
  }

  async findOne(id: string, withDeleted = false): Promise<Role> {
    const role = await this.rolesRepo.findOne({
      where: { id },
      relations: { permissions: true },
      withDeleted,
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const exists = await this.rolesRepo.findOne({ where: { name: dto.name }, withDeleted: true });
    if (exists) throw new ConflictException('Ya existe un rol con ese nombre');
    const permissions = await this.resolvePermissions(dto.permissionIds);
    const role = this.rolesRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
      permissions,
    });
    return this.rolesRepo.save(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOne(id);
    ensureNotSystem(role, 'modificar');
    if (dto.name && dto.name !== role.name) {
      const dupe = await this.rolesRepo.findOne({ where: { name: dto.name }, withDeleted: true });
      if (dupe) throw new ConflictException('Ya existe un rol con ese nombre');
      role.name = dto.name;
    }
    if (dto.description !== undefined) role.description = dto.description ?? null;
    if (dto.isActive !== undefined) role.isActive = dto.isActive;
    if (dto.permissionIds) {
      role.permissions = await this.resolvePermissions(dto.permissionIds);
    }
    return this.rolesRepo.save(role);
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto): Promise<Role> {
    const role = await this.findOne(id);
    ensureNotSystem(role, 'modificar permisos de');
    role.permissions = await this.resolvePermissions(dto.permissionIds);
    return this.rolesRepo.save(role);
  }

  async softDelete(id: string): Promise<void> {
    const role = await this.findOne(id);
    ensureNotSystem(role, 'eliminar');
    await this.rolesRepo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    const role = await this.findOne(id, true);
    ensureNotSystem(role, 'eliminar');
    await this.rolesRepo.delete(id);
  }

  async restore(id: string): Promise<Role> {
    const role = await this.rolesRepo.findOne({ where: { id }, withDeleted: true });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (!role.deletedAt) return role;
    await this.rolesRepo.restore(id);
    return this.findOne(id);
  }

  private async resolvePermissions(ids?: string[]): Promise<Permission[]> {
    if (!ids || ids.length === 0) return [];
    const permissions = await this.permissionsRepo.find({ where: { id: In(ids) } });
    if (permissions.length !== ids.length) {
      throw new BadRequestException('Algunos permisos no existen');
    }
    return permissions;
  }
}
