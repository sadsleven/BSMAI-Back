import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { TokenBlacklistService } from './services/token-blacklist.service';
import type { AuthenticatedUser } from './types/authenticated-user';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeOwnPasswordDto } from './dto/change-own-password.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly blacklist: TokenBlacklistService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: PublicUser }> {
    const user = await this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .leftJoinAndSelect('r.permissions', 'p')
      .leftJoinAndSelect('u.branches', 'b')
      .addSelect('u.password')
      .where('u.email = :email', { email: email.toLowerCase() })
      .getOne();

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        jwtid: jti,
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: (this.config.get<string>('JWT_EXPIRATION') ?? '7d') as unknown as number,
      },
    );

    const branches = await this.resolveVisibleBranches(user);
    return { accessToken, user: toPublicUser(user, branches) };
  }

  /**
   * Valida credenciales de un usuario validador (email + contraseña) sin emitir
   * token. Usado por flujos de autorización (ej. autorizar monto de orden).
   * Devuelve identidad + permisos efectivos. Lanza si credenciales inválidas o
   * usuario inactivo/eliminado.
   */
  async verifyValidator(
    email: string,
    password: string,
  ): Promise<ValidatedUser> {
    const user = await this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .leftJoinAndSelect('r.permissions', 'p')
      .addSelect('u.password')
      .where('u.email = :email', { email: email.toLowerCase() })
      .getOne();

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Credenciales del validador inválidas');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales del validador inválidas');

    const permissions = new Set<string>();
    for (const role of user.roles ?? []) {
      if (!role.isActive || role.deletedAt) continue;
      for (const perm of role.permissions ?? []) permissions.add(perm.name);
    }
    return {
      id: user.id,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      permissions: Array.from(permissions),
    };
  }

  async logout(authUser: AuthenticatedUser, exp?: number): Promise<void> {
    if (authUser.jti && exp) this.blacklist.add(authUser.jti, exp);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { roles: { permissions: true }, branches: true },
    });
    if (!user) throw new UnauthorizedException();
    const branches = await this.resolveVisibleBranches(user);
    return toPublicUser(user, branches);
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const dupe = await this.usersRepo.findOne({
        where: { email: dto.email.toLowerCase() },
        withDeleted: true,
      });
      if (dupe && dupe.id !== userId) {
        throw new ConflictException('Ya existe un usuario con ese email');
      }
      user.email = dto.email.toLowerCase();
    }
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber ?? null;
    if (dto.academicDegree !== undefined)
      user.academicDegree = dto.academicDegree?.trim() || null;
    if (dto.jobTitle !== undefined) user.jobTitle = dto.jobTitle?.trim() || null;

    await this.usersRepo.save(user);
    return this.me(userId);
  }

  async changeOwnPassword(userId: string, dto: ChangeOwnPasswordDto): Promise<void> {
    const user = await this.usersRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const ok = await bcrypt.compare(dto.currentPassword, user.password);
    if (!ok) throw new UnauthorizedException('La contraseña actual es incorrecta');

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta a la actual',
      );
    }

    user.password = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepo.save(user);
  }

  /**
   * Branches the user can see in the FE.
   * - Super Admin: all active + non-deleted branches.
   * - Regular user: own assignments filtered to active + non-deleted.
   *
   * Single source of truth — FE helper `getUserBranches()` reads from
   * `currentUser.branches` directly, no extra fetch needed.
   */
  private async resolveVisibleBranches(user: User): Promise<PublicBranch[]> {
    if (user.isSuperAdmin) {
      const all = await this.branchesRepo.find({
        where: { isActive: true, deletedAt: IsNull() },
        order: { name: 'ASC' },
      });
      return all.map((b) => ({ id: b.id, name: b.name }));
    }
    return (user.branches ?? [])
      .filter((b) => b.isActive && !b.deletedAt)
      .map((b) => ({ id: b.id, name: b.name }));
  }
}

export interface ValidatedUser {
  id: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: string[];
}

export interface PublicBranch {
  id: string;
  name: string;
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  academicDegree?: string | null;
  jobTitle?: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  roles: { id: string; name: string }[];
  permissions: string[];
  /**
   * Branches visible to the user. Super Admin: all active branches. Regular:
   * own assignments filtered to active+non-deleted. Stale assignments are
   * stripped here, so FE never has to filter them.
   */
  branches: PublicBranch[];
}

export function toPublicUser(user: User, branches: PublicBranch[]): PublicUser {
  const activeRoles = (user.roles ?? []).filter((r) => r.isActive && !r.deletedAt);
  const permissions = new Set<string>();
  for (const role of activeRoles) {
    for (const perm of role.permissions ?? []) permissions.add(perm.name);
  }
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phoneNumber: user.phoneNumber ?? null,
    academicDegree: user.academicDegree ?? null,
    jobTitle: user.jobTitle ?? null,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    roles: activeRoles.map((r) => ({ id: r.id, name: r.name })),
    permissions: Array.from(permissions),
    branches,
  };
}
