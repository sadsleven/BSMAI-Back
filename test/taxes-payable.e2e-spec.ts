import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('TaxesPayableController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /taxes-payable → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/taxes-payable').expect(401);
  });

  it('GET /taxes-payable → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/taxes-payable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /taxes-payable/:id → 404 con UUID inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/taxes-payable/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token));
    expect([404, 400]).toContain(res.status);
  });

  it('POST /taxes-payable/register-payment → 400 sin taxPayableIds', async () => {
    const res = await request(app.getHttpServer())
      .post('/taxes-payable/register-payment')
      .set(authHeader(token))
      .send({ taxPayableIds: [], payments: [] });
    expect([400, 422]).toContain(res.status);
  });
});
