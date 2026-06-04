import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('AppConfigController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let originalRate: number | null = null;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    // Restaurar valor original para no impactar otros tests/desarrollo.
    if (originalRate !== null) {
      await request(app.getHttpServer())
        .put('/app-config/cashea')
        .set(authHeader(token))
        .send({ commissionRate: originalRate });
    }
    await closeApp(app);
  });

  it('GET /app-config/cashea → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/app-config/cashea').expect(401);
  });

  it('GET /app-config/cashea → devuelve commissionRate', async () => {
    const res = await request(app.getHttpServer())
      .get('/app-config/cashea')
      .set(authHeader(token))
      .expect(200);
    expect(typeof res.body.commissionRate).toBe('number');
    originalRate = res.body.commissionRate;
  });

  it('PUT /app-config/cashea → actualiza commissionRate', async () => {
    const res = await request(app.getHttpServer())
      .put('/app-config/cashea')
      .set(authHeader(token))
      .send({ commissionRate: 0.15 });
    expect([200, 201]).toContain(res.status);
    expect(res.body.commissionRate).toBeCloseTo(0.15, 4);
  });

  it('PUT /app-config/cashea → 400 con valor fuera de rango', async () => {
    const res = await request(app.getHttpServer())
      .put('/app-config/cashea')
      .set(authHeader(token))
      .send({ commissionRate: 0.9 });
    expect([400, 422]).toContain(res.status);
  });
});
