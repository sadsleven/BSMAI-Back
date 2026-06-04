import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueName } from './helpers/unique';

describe('ServiceTypesController (e2e)', () => {
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

  it('GET /service-types → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/service-types').expect(401);
  });

  it('GET /service-types → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/service-types')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /service-types/assignable', async () => {
    const res = await request(app.getHttpServer())
      .get('/service-types/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /service-types → crea con precio Particular', async () => {
    const res = await request(app.getHttpServer())
      .post('/service-types')
      .set(authHeader(token))
      .send({
        name: uniqueName('ST E2E'),
        description: 'e2e',
        particularPriceUsd: 25.5,
      });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /service-types/:id', async () => {
    await request(app.getHttpServer())
      .get(`/service-types/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /service-types/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/service-types/${id}`)
      .set(authHeader(token))
      .send({ particularPriceUsd: 30 });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /service-types/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/service-types/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /service-types/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/service-types/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /service-types/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/service-types/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /service-types/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/service-types/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/service-types/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
