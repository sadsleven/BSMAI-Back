import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('ExchangeRatesController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let id: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /exchange-rates → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/exchange-rates').expect(401);
  });

  it('GET /exchange-rates → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/exchange-rates')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /exchange-rates/current?currency=USD', async () => {
    const res = await request(app.getHttpServer())
      .get('/exchange-rates/current?currency=USD')
      .set(authHeader(token));
    expect([200, 404]).toContain(res.status);
  });

  it('GET /exchange-rates/current-summary', async () => {
    await request(app.getHttpServer())
      .get('/exchange-rates/current-summary')
      .set(authHeader(token))
      .expect(200);
  });

  it('POST /exchange-rates → crea USD', async () => {
    const res = await request(app.getHttpServer())
      .post('/exchange-rates')
      .set(authHeader(token))
      .send({
        currency: 'USD',
        amountBs: +(100 + Math.random() * 100).toFixed(2),
        effectiveDate: todayIso(),
        isActive: true,
      });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /exchange-rates/:id', async () => {
    await request(app.getHttpServer())
      .get(`/exchange-rates/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /exchange-rates/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/exchange-rates/${id}`)
      .set(authHeader(token))
      .send({ isActive: true });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /exchange-rates/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/exchange-rates/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /exchange-rates/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/exchange-rates/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /exchange-rates/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/exchange-rates/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /exchange-rates/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/exchange-rates/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/exchange-rates/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
