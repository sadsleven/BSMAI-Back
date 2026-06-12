import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('TaxUnitsController (e2e)', () => {
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

  it('GET /tax-units → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/tax-units').expect(401);
  });

  it('GET /tax-units → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/tax-units')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /tax-units/current → UT vigente o 404 si no hay', async () => {
    const res = await request(app.getHttpServer())
      .get('/tax-units/current')
      .set(authHeader(token));
    expect([200, 404]).toContain(res.status);
  });

  it('POST /tax-units → crea', async () => {
    const amountBs = +(Math.random() * 100).toFixed(2) + 1;
    const res = await request(app.getHttpServer())
      .post('/tax-units')
      .set(authHeader(token))
      .send({ amountBs, effectiveDate: todayIso(), isActive: true });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /tax-units/:id', async () => {
    await request(app.getHttpServer())
      .get(`/tax-units/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /tax-units/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tax-units/${id}`)
      .set(authHeader(token))
      .send({ isActive: true });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /tax-units/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tax-units/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /tax-units/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/tax-units/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /tax-units/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tax-units/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /tax-units/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/tax-units/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/tax-units/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
