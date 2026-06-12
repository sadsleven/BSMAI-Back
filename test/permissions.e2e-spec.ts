import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('PermissionsController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /permissions → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/permissions').expect(401);
  });

  it('GET /permissions → catálogo no vacío', async () => {
    const res = await request(app.getHttpServer())
      .get('/permissions')
      .set(authHeader(token))
      .expect(200);
    const body = res.body as Array<unknown> | { data?: unknown[] };
    const items = Array.isArray(body) ? body : body.data ?? [];
    expect(items.length).toBeGreaterThan(0);
  });
});
