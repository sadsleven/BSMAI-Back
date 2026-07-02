import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('AppConfigController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let original: { commissionRate: number; financingRate: number } | null = null;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    // Restaurar valores originales para no impactar otros tests/desarrollo.
    if (original !== null) {
      await request(app.getHttpServer())
        .put('/app-config/cashea')
        .set(authHeader(token))
        .send(original);
    }
    await closeApp(app);
  });

  it('GET /app-config/cashea → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/app-config/cashea').expect(401);
  });

  it('GET /app-config/cashea → devuelve commissionRate y financingRate', async () => {
    const res = await request(app.getHttpServer())
      .get('/app-config/cashea')
      .set(authHeader(token))
      .expect(200);
    expect(typeof res.body.commissionRate).toBe('number');
    expect(typeof res.body.financingRate).toBe('number');
    original = {
      commissionRate: res.body.commissionRate,
      financingRate: res.body.financingRate,
    };
  });

  it('PUT /app-config/cashea → actualiza ambas tasas', async () => {
    const res = await request(app.getHttpServer())
      .put('/app-config/cashea')
      .set(authHeader(token))
      .send({ commissionRate: 0.0464, financingRate: 0.062 });
    expect([200, 201]).toContain(res.status);
    expect(res.body.commissionRate).toBeCloseTo(0.0464, 4);
    expect(res.body.financingRate).toBeCloseTo(0.062, 4);
  });

  it('PUT /app-config/cashea → 400 con valor fuera de rango', async () => {
    const res = await request(app.getHttpServer())
      .put('/app-config/cashea')
      .set(authHeader(token))
      .send({ commissionRate: 0.9, financingRate: 0.062 });
    expect([400, 422]).toContain(res.status);
  });

  it('PUT /app-config/cashea → 400 si falta una tasa', async () => {
    const res = await request(app.getHttpServer())
      .put('/app-config/cashea')
      .set(authHeader(token))
      .send({ commissionRate: 0.0464 });
    expect([400, 422]).toContain(res.status);
  });
});
