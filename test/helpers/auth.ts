import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

/**
 * Token cacheado por proceso para no re-loguear en cada spec. Cada suite
 * llama `loginAsSuperAdmin(app)` en su `beforeAll` y obtiene el JWT.
 */
let cachedToken: string | null = null;

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    isSuperAdmin: boolean;
    [k: string]: unknown;
  };
}

export async function loginAsSuperAdmin(app: INestApplication): Promise<string> {
  if (cachedToken) return cachedToken;
  const email = process.env.SUPER_ADMIN_EMAIL ?? 'admin@afmi.local';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `Super Admin login failed (status=${res.status}): ${JSON.stringify(res.body)}`,
    );
  }
  const body = res.body as LoginResult & { access_token?: string; token?: string };
  const token = body.accessToken ?? body.access_token ?? body.token;
  if (!token) {
    throw new Error(
      `Login response missing access token: ${JSON.stringify(body)}`,
    );
  }
  cachedToken = token;
  return token;
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Útil cuando un test cambia el password del Super Admin u otras condiciones. */
export function clearCachedToken(): void {
  cachedToken = null;
}
