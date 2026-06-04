import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET / → 401 sin token (JWT global)', async () => {
    await request(app.getHttpServer()).get('/').expect(401);
  });

  it('GET / → 200 con token', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set(authHeader(token))
      .expect(200);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(0);
  });
});
