import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { ensureSpecialty } from './helpers/fixtures';
import { uniqueName } from './helpers/unique';

describe('CareCentersController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let specialtyId: string;
  let id: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
    specialtyId = (await ensureSpecialty(app, token)).id;
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /care-centers → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/care-centers').expect(401);
  });

  it('GET /care-centers → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/care-centers')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /care-centers/assignable', async () => {
    const res = await request(app.getHttpServer())
      .get('/care-centers/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /care-centers → crea', async () => {
    const res = await request(app.getHttpServer())
      .post('/care-centers')
      .set(authHeader(token))
      .send({
        businessName: uniqueName('Centro E2E'),
        phones: [],
        specialtyIds: [specialtyId],
      });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /care-centers/:id', async () => {
    await request(app.getHttpServer())
      .get(`/care-centers/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /care-centers/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/care-centers/${id}`)
      .set(authHeader(token))
      .send({ businessName: uniqueName('Centro E2E Upd') });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /care-centers/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/care-centers/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /care-centers/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/care-centers/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /care-centers/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/care-centers/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /care-centers/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/care-centers/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/care-centers/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
