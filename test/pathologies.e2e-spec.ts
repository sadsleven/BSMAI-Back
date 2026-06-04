import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueName } from './helpers/unique';

describe('PathologiesController (e2e)', () => {
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

  it('GET /pathologies → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/pathologies').expect(401);
  });

  it('GET /pathologies → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/pathologies')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /pathologies/assignable', async () => {
    const res = await request(app.getHttpServer())
      .get('/pathologies/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /pathologies → crea', async () => {
    const res = await request(app.getHttpServer())
      .post('/pathologies')
      .set(authHeader(token))
      .send({ name: uniqueName('Pat E2E'), description: 'e2e' });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /pathologies/:id', async () => {
    await request(app.getHttpServer())
      .get(`/pathologies/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /pathologies/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/pathologies/${id}`)
      .set(authHeader(token))
      .send({ description: 'editada' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /pathologies/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/pathologies/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /pathologies/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/pathologies/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /pathologies/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/pathologies/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /pathologies/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/pathologies/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/pathologies/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
