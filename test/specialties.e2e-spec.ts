import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueName } from './helpers/unique';

describe('SpecialtiesController (e2e)', () => {
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

  it('GET /specialties → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/specialties').expect(401);
  });

  it('GET /specialties → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/specialties')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /specialties/assignable → lista', async () => {
    const res = await request(app.getHttpServer())
      .get('/specialties/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /specialties → crea', async () => {
    const res = await request(app.getHttpServer())
      .post('/specialties')
      .set(authHeader(token))
      .send({ name: uniqueName('Esp E2E'), description: 'e2e' });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /specialties/:id', async () => {
    await request(app.getHttpServer())
      .get(`/specialties/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /specialties/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/specialties/${id}`)
      .set(authHeader(token))
      .send({ description: 'editada' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /specialties/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/specialties/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /specialties/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/specialties/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /specialties/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/specialties/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /specialties/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/specialties/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/specialties/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
