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
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { TokenBlacklistService } from './services/token-blacklist.service';
import type { AuthenticatedUser } from './types/authenticated-user';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeOwnPasswordDto } from './dto/change-own-password.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly blacklist: TokenBlacklistService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: PublicUser }> {
    const user = await this.usersRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .leftJoinAndSelect('r.permissions', 'p')
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

    return { accessToken, user: toPublicUser(user) };
  }

  async logout(authUser: AuthenticatedUser, exp?: number): Promise<void> {
    if (authUser.jti && exp) this.blacklist.add(authUser.jti, exp);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { roles: { permissions: true } },
    });
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
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
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  roles: { id: string; name: string }[];
  permissions: string[];
}

export function toPublicUser(user: User): PublicUser {
  const permissions = new Set<string>();
  for (const role of user.roles ?? []) {
    for (const perm of role.permissions ?? []) permissions.add(perm.name);
  }
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phoneNumber: user.phoneNumber ?? null,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    roles: (user.roles ?? []).map((r) => ({ id: r.id, name: r.name })),
    permissions: Array.from(permissions),
  };
}
