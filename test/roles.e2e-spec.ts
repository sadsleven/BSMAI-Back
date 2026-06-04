import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { uniqueName } from './helpers/unique';

describe('RolesController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let roleId: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /roles → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/roles').expect(401);
  });

  it('GET /roles → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/roles')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /roles/assignable → lista activa + non-deleted', async () => {
    const res = await request(app.getHttpServer())
      .get('/roles/assignable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /roles → crea rol', async () => {
    const res = await request(app.getHttpServer())
      .post('/roles')
      .set(authHeader(token))
      .send({
        name: uniqueName('Rol E2E'),
        description: 'Rol creado por test e2e',
        permissionIds: [],
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.id).toBeDefined();
    roleId = res.body.id;
  });

  it('GET /roles/:id → detalle del rol', async () => {
    const res = await request(app.getHttpServer())
      .get(`/roles/${roleId}`)
      .set(authHeader(token))
      .expect(200);
    expect(res.body.id).toBe(roleId);
  });

  it('PATCH /roles/:id → actualiza descripción', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/roles/${roleId}`)
      .set(authHeader(token))
      .send({ description: 'Actualizado por e2e' });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /roles/:id/permissions → asigna permisos vacíos', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/roles/${roleId}/permissions`)
      .set(authHeader(token))
      .send({ permissionIds: [] });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /roles/:id/toggle-active → alterna estado', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/roles/${roleId}/toggle-active`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /roles/:id → soft-delete', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/roles/${roleId}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /roles/:id/restore → restaura', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/roles/${roleId}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /roles/:id/permanent → hard-delete', async () => {
    await request(app.getHttpServer())
      .delete(`/roles/${roleId}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/roles/${roleId}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
