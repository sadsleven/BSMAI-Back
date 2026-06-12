import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueCedula } from './helpers/unique';

describe('PatientsController (e2e)', () => {
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

  it('GET /patients → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/patients').expect(401);
  });

  it('GET /patients → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/patients')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /patients → crea persona natural', async () => {
    const res = await request(app.getHttpServer())
      .post('/patients')
      .set(authHeader(token))
      .send({
        personType: 'natural',
        cedula: uniqueCedula(),
        firstName: 'Juan',
        lastName: 'Perez',
        birthDate: '1990-01-15',
        address: 'Av. Principal Caracas',
        phones: [],
      });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /patients/:id', async () => {
    await request(app.getHttpServer())
      .get(`/patients/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('GET /patients/:id/available-insurances', async () => {
    const res = await request(app.getHttpServer())
      .get(`/patients/${id}/available-insurances`)
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH /patients/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/patients/${id}`)
      .set(authHeader(token))
      .send({ address: 'Otra dirección Caracas' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /patients/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/patients/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /patients/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/patients/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /patients/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/patients/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /patients/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/patients/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/patients/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
