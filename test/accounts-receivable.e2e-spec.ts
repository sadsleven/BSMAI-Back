import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('AccountsReceivableController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /accounts-receivable → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/accounts-receivable').expect(401);
  });

  it('GET /accounts-receivable → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/accounts-receivable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /accounts-receivable/:id → 404 con UUID inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/accounts-receivable/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token));
    expect([404, 400]).toContain(res.status);
  });

  it('POST /accounts-receivable/register-collection → 400 sin receivableIds', async () => {
    const res = await request(app.getHttpServer())
      .post('/accounts-receivable/register-collection')
      .set(authHeader(token))
      .send({ receivableIds: [], payments: [] });
    expect([400, 422]).toContain(res.status);
  });
});
