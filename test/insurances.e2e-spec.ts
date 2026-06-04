import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueName } from './helpers/unique';

describe('InsurancesController (e2e)', () => {
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

  it('GET /insurances → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/insurances').expect(401);
  });

  it('GET /insurances → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/insurances')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /insurances/assignable', async () => {
    const res = await request(app.getHttpServer())
      .get('/insurances/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /insurances → crea', async () => {
    const res = await request(app.getHttpServer())
      .post('/insurances')
      .set(authHeader(token))
      .send({
        name: uniqueName('Seguro E2E'),
        description: 'e2e',
        phones: [],
      });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /insurances/:id', async () => {
    await request(app.getHttpServer())
      .get(`/insurances/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /insurances/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/insurances/${id}`)
      .set(authHeader(token))
      .send({ description: 'editado' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /insurances/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/insurances/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /insurances/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/insurances/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /insurances/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/insurances/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /insurances/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/insurances/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/insurances/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
