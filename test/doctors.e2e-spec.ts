import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { ensureSpecialty } from './helpers/fixtures';
import { uniqueCedula } from './helpers/unique';

describe('DoctorsController (e2e)', () => {
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

  it('GET /doctors → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/doctors').expect(401);
  });

  it('GET /doctors → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/doctors')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /doctors/assignable', async () => {
    const res = await request(app.getHttpServer())
      .get('/doctors/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /doctors → crea persona natural', async () => {
    const res = await request(app.getHttpServer())
      .post('/doctors')
      .set(authHeader(token))
      .send({
        cedula: uniqueCedula(),
        firstName: 'Maria',
        lastName: 'Lopez',
        isLegalEntity: false,
        phones: [],
        specialtyIds: [specialtyId],
      });
    expect([200, 201]).toContain(res.status);
    id = res.body.id;
  });

  it('GET /doctors/:id', async () => {
    await request(app.getHttpServer())
      .get(`/doctors/${id}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /doctors/:id', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/doctors/${id}`)
      .set(authHeader(token))
      .send({ firstName: 'María' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /doctors/:id/toggle-active', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/doctors/${id}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /doctors/:id → soft', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/doctors/${id}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /doctors/:id/restore', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/doctors/${id}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /doctors/:id/permanent', async () => {
    await request(app.getHttpServer())
      .delete(`/doctors/${id}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/doctors/${id}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
