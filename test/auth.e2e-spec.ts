import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  const adminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@afmi.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('POST /auth/login → token + user con credenciales válidas', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    expect([200, 201]).toContain(res.status);
    const tokenField =
      res.body.accessToken ?? res.body.access_token ?? res.body.token;
    expect(typeof tokenField).toBe('string');
    expect(tokenField.length).toBeGreaterThan(10);
    expect(res.body.user?.email).toBe(adminEmail);
  });

  it('POST /auth/login → 401 con password inválida', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: 'wrong-password-xx' })
      .expect(401);
  });

  it('GET /auth/me → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('GET /auth/me → datos del usuario con token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(token))
      .expect(200);
    expect(res.body.email).toBe(adminEmail);
    expect(res.body.isSuperAdmin).toBe(true);
  });

  it('PATCH /auth/me → actualiza nombre con token', async () => {
    const res = await request(app.getHttpServer())
      .patch('/auth/me')
      .set(authHeader(token))
      .send({ firstName: 'Super', lastName: 'Admin' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /auth/me/password → 401 sin token', async () => {
    await request(app.getHttpServer())
      .patch('/auth/me/password')
      .send({ currentPassword: 'x', newPassword: 'YY12345!' })
      .expect(401);
  });

  it('POST /auth/logout → 200/201 con token', async () => {
    // Login dedicado para no invalidar el token compartido del resto de suites.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    const tmpToken =
      login.body.accessToken ?? login.body.access_token ?? login.body.token;
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set({ Authorization: `Bearer ${tmpToken}` })
      .send({});
    expect([200, 201, 204]).toContain(res.status);
  });
});
