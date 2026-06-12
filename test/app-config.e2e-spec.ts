import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('AppConfigController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let original: { firstInstallmentRate: number; totalRate: number } | null = null;

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

  it('GET /app-config/cashea → devuelve firstInstallmentRate y totalRate', async () => {
    const res = await request(app.getHttpServer())
      .get('/app-config/cashea')
      .set(authHeader(token))
      .expect(200);
    expect(typeof res.body.firstInstallmentRate).toBe('number');
    expect(typeof res.body.totalRate).toBe('number');
    original = {
      firstInstallmentRate: res.body.firstInstallmentRate,
      totalRate: res.body.totalRate,
    };
  });

  it('PUT /app-config/cashea → actualiza ambas tasas', async () => {
    const res = await request(app.getHttpServer())
      .put('/app-config/cashea')
      .set(authHeader(token))
      .send({ firstInstallmentRate: 0.04, totalRate: 0.06 });
    expect([200, 201]).toContain(res.status);
    expect(res.body.firstInstallmentRate).toBeCloseTo(0.04, 4);
    expect(res.body.totalRate).toBeCloseTo(0.06, 4);
  });

  it('PUT /app-config/cashea → 400 con valor fuera de rango', async () => {
    const res = await request(app.getHttpServer())
      .put('/app-config/cashea')
      .set(authHeader(token))
      .send({ firstInstallmentRate: 0.9, totalRate: 0.06 });
    expect([400, 422]).toContain(res.status);
  });

  it('PUT /app-config/cashea → 400 si falta una tasa', async () => {
    const res = await request(app.getHttpServer())
      .put('/app-config/cashea')
      .set(authHeader(token))
      .send({ firstInstallmentRate: 0.04 });
    expect([400, 422]).toContain(res.status);
  });
});
