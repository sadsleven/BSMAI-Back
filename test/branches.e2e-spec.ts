import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueName } from './helpers/unique';

describe('BranchesController (e2e)', () => {
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

  it('GET /branches → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/branches').expect(401);
  });

  it('GET /branches → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/branches')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /branches/assignable', async () => {
    const res = await request(app.getHttpServer())
      .get('/branches/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /branches → crea', async () => {
    const res = await request(app.getHttpServer())
      .post('/branches')
      .set(authHeader(token))
      .send({ name: uniqueName('Suc E2E'), description: 'e2e' });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /branches/:id', async () => {
    await request(app.getHttpServer())
      .get(`/branches/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /branches/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${id}`)
      .set(authHeader(token))
      .send({ description: 'editada' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /branches/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /branches/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/branches/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /branches/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/branches/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /branches/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/branches/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/branches/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
