import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { ensureSpecialty } from './helpers/fixtures';
import { uniqueCedula, uniqueEmail, uniqueName } from './helpers/unique';

/**
 * E2E del acceso de proveedores: al crear un doctor/centro con contraseña se
 * aprovisiona una cuenta de usuario (rol Proveedor) vinculada por `userId`. El
 * proveedor puede loguear, su `/auth/me` trae `providerLink`, puede listar
 * órdenes pero no otros recursos, y su contraseña se cambia por endpoint admin.
 */
describe('Provider accounts (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let specialtyId: string;

  const PASSWORD = 'Proveedor123!';
  const NEW_PASSWORD = 'Proveedor456!';

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
    specialtyId = (await ensureSpecialty(app, token)).id;
  });

  afterAll(async () => {
    await closeApp(app);
  });

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/auth/login').send({ email, password });

  const tokenOf = (body: Record<string, unknown>): string | undefined =>
    (body.accessToken as string) ??
    (body.access_token as string) ??
    (body.token as string);

  describe('Doctor con acceso', () => {
    const email = uniqueEmail('doc-acc');
    let doctorId: string;
    let providerToken: string | undefined;

    it('POST /doctors con password → crea doctor + cuenta vinculada (userId)', async () => {
      const res = await request(app.getHttpServer())
        .post('/doctors')
        .set(authHeader(token))
        .send({
          cedula: uniqueCedula(),
          email,
          firstName: 'Acceso',
          lastName: 'Doctor',
          isLegalEntity: false,
          phones: [],
          specialtyIds: [specialtyId],
          password: PASSWORD,
        });
      expect([200, 201]).toContain(res.status);
      doctorId = res.body.id;
      expect(res.body.userId).toBeTruthy();
    });

    it('login del doctor → token + providerLink doctor', async () => {
      if (!doctorId) return;
      const res = await login(email, PASSWORD);
      expect([200, 201]).toContain(res.status);
      providerToken = tokenOf(res.body);
      expect(providerToken).toBeTruthy();
      expect(res.body.user?.providerLink).toMatchObject({
        type: 'doctor',
        id: doctorId,
      });
    });

    it('GET /auth/me del doctor → providerLink', async () => {
      if (!providerToken) return;
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set(authHeader(providerToken))
        .expect(200);
      expect(res.body.providerLink).toMatchObject({
        type: 'doctor',
        id: doctorId,
      });
    });

    it('proveedor puede listar órdenes (orders.list)', async () => {
      if (!providerToken) return;
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set(authHeader(providerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('proveedor NO puede listar doctores (sin permiso)', async () => {
      if (!providerToken) return;
      const res = await request(app.getHttpServer())
        .get('/doctors')
        .set(authHeader(providerToken));
      expect(res.status).toBe(403);
    });

    it('PATCH /doctors/:id/change-password → nueva contraseña funciona, vieja no', async () => {
      if (!doctorId) return;
      const res = await request(app.getHttpServer())
        .patch(`/doctors/${doctorId}/change-password`)
        .set(authHeader(token))
        .send({ newPassword: NEW_PASSWORD, confirmNewPassword: NEW_PASSWORD });
      expect([200, 204]).toContain(res.status);

      const withNew = await login(email, NEW_PASSWORD);
      expect([200, 201]).toContain(withNew.status);
      const withOld = await login(email, PASSWORD);
      expect(withOld.status).toBe(401);
    });
  });

  describe('Doctor sin acceso', () => {
    let doctorId: string;

    it('POST /doctors sin password → sin userId', async () => {
      const res = await request(app.getHttpServer())
        .post('/doctors')
        .set(authHeader(token))
        .send({
          cedula: uniqueCedula(),
          email: uniqueEmail('doc-noacc'),
          firstName: 'Sin',
          lastName: 'Acceso',
          isLegalEntity: false,
          phones: [],
          specialtyIds: [specialtyId],
        });
      expect([200, 201]).toContain(res.status);
      doctorId = res.body.id;
      expect(res.body.userId ?? null).toBeNull();
    });

    it('change-password sin acceso habilitado → 400', async () => {
      if (!doctorId) return;
      const res = await request(app.getHttpServer())
        .patch(`/doctors/${doctorId}/change-password`)
        .set(authHeader(token))
        .send({ newPassword: PASSWORD, confirmNewPassword: PASSWORD });
      expect(res.status).toBe(400);
    });

    it('POST /doctors sin email → 400 (email obligatorio)', async () => {
      const res = await request(app.getHttpServer())
        .post('/doctors')
        .set(authHeader(token))
        .send({
          cedula: uniqueCedula(),
          firstName: 'SinMail',
          lastName: 'Doctor',
          isLegalEntity: false,
          phones: [],
          specialtyIds: [specialtyId],
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Centro con acceso', () => {
    const email = uniqueEmail('cc-acc');

    it('POST /care-centers con password → cuenta vinculada + providerLink care_center', async () => {
      const res = await request(app.getHttpServer())
        .post('/care-centers')
        .set(authHeader(token))
        .send({
          businessName: uniqueName('Centro Acc'),
          email,
          phones: [],
          specialtyIds: [specialtyId],
          password: PASSWORD,
        });
      expect([200, 201]).toContain(res.status);
      const careCenterId = res.body.id;
      expect(res.body.userId).toBeTruthy();

      const loginRes = await login(email, PASSWORD);
      expect([200, 201]).toContain(loginRes.status);
      expect(loginRes.body.user?.providerLink).toMatchObject({
        type: 'care_center',
        id: careCenterId,
      });
    });
  });
});
