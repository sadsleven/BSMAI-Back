import { Global, Injectable, Module } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Caché en memoria del contexto autenticado (usuario + roles + permisos).
 *
 * Sin ella, CADA request resolvía el JWT con un `findOne` del usuario uniendo
 * roles y permisos — cientos de filas hidratadas por request y una ida y vuelta
 * a la base antes siquiera de entrar al controlador. Una pantalla que dispara 4
 * o 5 llamadas pagaba ese costo 4 o 5 veces; contra una base remota es la mayor
 * parte de la espera.
 *
 * La entrada vive `TTL_MS` y se invalida de inmediato cuando cambian el usuario
 * (alta/edición/roles/estado) o cualquier rol/permiso. El logout no depende de
 * esto: la revocación del `jti` se consulta antes de la caché.
 */
const TTL_MS = 30_000;

interface Entry {
  at: number;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthContextCache {
  private readonly entries = new Map<string, Entry>();

  /** Contexto cacheado de un `jti`, o `null` si no está o expiró. */
  get(jti: string | undefined): AuthenticatedUser | null {
    if (!jti) return null;
    const hit = this.entries.get(jti);
    if (!hit) return null;
    if (Date.now() - hit.at >= TTL_MS) {
      this.entries.delete(jti);
      return null;
    }
    return hit.user;
  }

  set(jti: string | undefined, user: AuthenticatedUser): void {
    if (!jti) return;
    this.entries.set(jti, { at: Date.now(), user });
  }

  /** Invalida las sesiones de un usuario (cambió su estado, roles o datos). */
  invalidateUser(userId: string): void {
    for (const [jti, entry] of this.entries) {
      if (entry.user.id === userId) this.entries.delete(jti);
    }
  }

  /** Invalida un token puntual (logout). */
  invalidateToken(jti: string | undefined): void {
    if (jti) this.entries.delete(jti);
  }

  /** Invalida todo: cambió un rol o sus permisos y afecta a varios usuarios. */
  invalidateAll(): void {
    this.entries.clear();
  }
}

/**
 * Global para que `auth`, `users` y `roles` compartan la misma instancia sin
 * importarse entre sí (y sin ciclos de módulos).
 */
@Global()
@Module({
  providers: [AuthContextCache],
  exports: [AuthContextCache],
})
export class AuthContextCacheModule {}
