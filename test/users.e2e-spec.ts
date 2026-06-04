import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueEmail, uniqueName } from './helpers/unique';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /users → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('GET /users → paginado con token', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.metadata).toBeDefined();
  });

  it('POST /users → crea usuario', async () => {
    const password = 'Strong#Pass1';
    const res = await request(app.getHttpServer())
      .post('/users')
      .set(authHeader(token))
      .send({
        email: uniqueEmail('user'),
        firstName: 'TestE2E',
        lastName: 'UserE2E',
        password,
        confirmPassword: password,
        phoneNumber: '04121234567',
        roleIds: [],
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeDefined();
    userId = res.body.id;
  });

  it('GET /users/:id → devuelve detalle', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set(authHeader(token))
      .expect(200);
    expect(res.body.id).toBe(userId);
  });

  it('PATCH /users/:id → actualiza nombre', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${userId}`)
      .set(authHeader(token))
      .send({ firstName: 'Updated' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /users/:id/change-password → cambia password', async () => {
    const newPassword = 'Updated#Pass1';
    const res = await request(app.getHttpServer())
      .patch(`/users/${userId}/change-password`)
      .set(authHeader(token))
      .send({ newPassword, confirmNewPassword: newPassword });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /users/:id/toggle-active → alterna estado', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${userId}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /users/:id → soft-delete', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/users/${userId}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /users/:id/restore → restaura', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${userId}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /users/:id/permanent → hard-delete', async () => {
    // Volver a soft-delete primero (algunos services exigen estar en papelera).
    await request(app.getHttpServer())
      .delete(`/users/${userId}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/users/${userId}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
