import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { AuthContextCache } from '../services/auth-context-cache.service';
import type { AuthenticatedUser } from '../types/authenticated-user';

interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly blacklist: TokenBlacklistService,
    private readonly cache: AuthContextCache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // La revocación se consulta SIEMPRE antes de la caché: un logout corta el
    // acceso al instante aunque el contexto siga cacheado.
    if (payload.jti && this.blacklist.has(payload.jti)) {
      throw new UnauthorizedException('Token revocado');
    }
    const cached = this.cache.get(payload.jti);
    if (cached) return cached;
    const user = await this.usersRepo.findOne({
      where: { id: payload.sub },
      relations: { roles: { permissions: true } },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Usuario no autorizado');
    }
    const activeRoles = (user.roles ?? []).filter(
      (r) => r.isActive && !r.deletedAt,
    );
    const permissions = new Set<string>();
    for (const role of activeRoles) {
      for (const perm of role.permissions ?? []) {
        permissions.add(perm.name);
      }
    }
    const context: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      roles: activeRoles.map((r) => r.name),
      permissions: Array.from(permissions),
      jti: payload.jti,
    };
    this.cache.set(payload.jti, context);
    return context;
  }
}
