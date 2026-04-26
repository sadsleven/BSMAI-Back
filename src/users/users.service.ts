import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { paginateBuilder } from '../shared/utils/paginate';
import { PaginatedResponse } from '../shared/interfaces/PaginatedResponse';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

const BCRYPT_ROUNDS = 10;

export type PublicUserView = Omit<User, 'password'> & { password?: never };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
  ) {}

  async findAll(query: QueryUsersDto): Promise<PaginatedResponse<PublicUserView>> {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      isSuperAdmin,
      roleId,
      sortBy = 'createdAt',
      sortDir = 'DESC',
      withDeleted,
    } = query;

    const qb = this.usersRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.roles', 'role')
      .leftJoinAndSelect('role.permissions', 'permission')
      .orderBy(`user.${sortBy}`, sortDir);

    if (withDeleted === 'true') qb.withDeleted();

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(user.firstName) LIKE :s OR LOWER(user.lastName) LIKE :s OR LOWER(user.email) LIKE :s)',
        { s: term },
      );
    }
    if (isActive === 'true' || isActive === 'false') {
      qb.andWhere('user.isActive = :a', { a: isActive === 'true' });
    }
    if (isSuperAdmin === 'true' || isSuperAdmin === 'false') {
      qb.andWhere('user.isSuperAdmin = :sa', { sa: isSuperAdmin === 'true' });
    }
    if (roleId) {
      qb.andWhere(
        'user.id IN (SELECT ur."userId" FROM users_roles ur WHERE ur."roleId" = :roleId)',
        { roleId },
      );
    }
    if (query.roleIds && query.roleIds.length) {
      qb.andWhere(
        'user.id IN (SELECT ur."userId" FROM users_roles ur WHERE ur."roleId" IN (:...rids))',
        { rids: query.roleIds },
      );
    }

    return paginateBuilder<User>(qb, page, limit) as unknown as Promise<
      PaginatedResponse<PublicUserView>
    >;
  }

  async findOne(id: string, withDeleted = false): Promise<PublicUserView> {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: { roles: { permissions: true } },
      withDeleted,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user as unknown as PublicUserView;
  }

  async create(dto: CreateUserDto): Promise<PublicUserView> {
    const email = dto.email.toLowerCase();
    const exists = await this.usersRepo.findOne({ where: { email }, withDeleted: true });
    if (exists) throw new ConflictException('Ya existe un usuario con ese email');
    const roles = await this.resolveRoles(dto.roleIds);
    const hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.usersRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      phoneNumber: dto.phoneNumber ?? null,
      password: hash,
      isActive: dto.isActive ?? true,
      isSuperAdmin: dto.isSuperAdmin ?? false,
      roles,
    });
    const saved = await this.usersRepo.save(user);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<PublicUserView> {
    const user = await this.usersRepo.findOne({ where: { id }, relations: { roles: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.isSuperAdmin && !actor.isSuperAdmin) {
      throw new ForbiddenException('No puedes modificar un Super Admin');
    }
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const dupe = await this.usersRepo.findOne({
        where: { email: dto.email.toLowerCase() },
        withDeleted: true,
      });
      if (dupe) throw new ConflictException('Ya existe un usuario con ese email');
      user.email = dto.email.toLowerCase();
    }
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber ?? null;
    const isSelf = actor.id === id;
    if (dto.isActive !== undefined) {
      if (isSelf && dto.isActive !== user.isActive) {
        throw new ForbiddenException('No podés cambiar tu propio estado');
      }
      user.isActive = dto.isActive;
    }
    if (dto.isSuperAdmin !== undefined) {
      if (!actor.isSuperAdmin) {
        throw new ForbiddenException('Sólo un Super Admin puede asignar Super Admin');
      }
      if (isSelf && dto.isSuperAdmin !== user.isSuperAdmin) {
        throw new ForbiddenException('No podés cambiar tu propio rol de Super Admin');
      }
      user.isSuperAdmin = dto.isSuperAdmin;
    }
    if (dto.roleIds) user.roles = await this.resolveRoles(dto.roleIds);
    await this.usersRepo.save(user);
    return this.findOne(id);
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const user = await this.usersRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const isSelf = actor.id === id;
    if (isSelf) {
      if (!dto.currentPassword) {
        throw new BadRequestException('La contraseña actual es requerida');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.password);
      if (!ok) throw new UnauthorizedException('La contraseña actual es incorrecta');
    } else if (!actor.isSuperAdmin && !actor.permissions.includes('users.change-password')) {
      throw new ForbiddenException('Permisos insuficientes');
    }
    user.password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepo.save(user);
  }

  async toggleActive(id: string, actor: AuthenticatedUser): Promise<PublicUserView> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (actor.id === id) {
      throw new ForbiddenException('No podés cambiar tu propio estado');
    }
    if (user.isSuperAdmin && !actor.isSuperAdmin) {
      throw new ForbiddenException('No puedes cambiar el estado de un Super Admin');
    }
    user.isActive = !user.isActive;
    await this.usersRepo.save(user);
    return this.findOne(id);
  }

  async softDelete(id: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.isSuperAdmin) {
      throw new BadRequestException('No se puede eliminar un Super Admin');
    }
    if (actor.id === id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }
    await this.usersRepo.softDelete(id);
  }

  async hardDelete(id: string, actor: AuthenticatedUser): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id }, withDeleted: true });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.isSuperAdmin) {
      throw new BadRequestException('No se puede eliminar un Super Admin');
    }
    if (actor.id === id) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }
    await this.usersRepo.delete(id);
  }

  async restore(id: string): Promise<PublicUserView> {
    const user = await this.usersRepo.findOne({ where: { id }, withDeleted: true });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.deletedAt) return this.findOne(id);
    await this.usersRepo.restore(id);
    return this.findOne(id);
  }

  private async resolveRoles(ids?: string[]): Promise<Role[]> {
    if (!ids || ids.length === 0) return [];
    const roles = await this.rolesRepo.find({ where: { id: In(ids) } });
    if (roles.length !== ids.length) {
      throw new BadRequestException('Algunos roles no existen');
    }
    return roles;
  }
}
