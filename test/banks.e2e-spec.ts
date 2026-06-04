import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('BanksController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /banks → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/banks').expect(401);
  });

  it('GET /banks → lista bancos venezolanos con token', async () => {
    const res = await request(app.getHttpServer())
      .get('/banks')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
