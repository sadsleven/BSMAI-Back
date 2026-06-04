import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueName } from './helpers/unique';

describe('ContractorsController (e2e)', () => {
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

  it('GET /contractors → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/contractors').expect(401);
  });

  it('GET /contractors → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/contractors')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /contractors/assignable', async () => {
    const res = await request(app.getHttpServer())
      .get('/contractors/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /contractors → crea', async () => {
    const res = await request(app.getHttpServer())
      .post('/contractors')
      .set(authHeader(token))
      .send({ name: uniqueName('Contr E2E'), description: 'e2e' });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /contractors/:id', async () => {
    await request(app.getHttpServer())
      .get(`/contractors/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /contractors/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/contractors/${id}`)
      .set(authHeader(token))
      .send({ description: 'editado' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /contractors/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/contractors/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /contractors/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/contractors/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /contractors/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/contractors/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /contractors/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/contractors/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/contractors/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
