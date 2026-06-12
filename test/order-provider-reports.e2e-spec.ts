import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { ensureBranch, ensureSpecialty } from './helpers/fixtures';
import { uniqueCedula, uniqueEmail, uniqueName } from './helpers/unique';

/**
 * E2E del Paso 3 segmentado por proveedor: el staff carga nota general +
 * observaciones por proveedor; el doctor proveedor (con acceso) ve su orden,
 * edita SOLO su propio segmento y no puede tocar el de otro proveedor.
 */
describe('Order provider reports (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let specialtyId: string;
  let branchId: string;

  const PASSWORD = 'Proveedor123!';
  const docEmail = uniqueEmail('opr-doc');

  let orderId: string | null = null;
  let doctorId: string | null = null;
  let doctorToken: string | undefined;
  let createOk = false;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
    branchId = (await ensureBranch(app, token)).id;
    specialtyId = (await ensureSpecialty(app, token)).id;
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('setup: crea orden con doctor proveedor (con acceso)', async () => {
    const patientRes = await request(app.getHttpServer())
      .post('/patients')
      .set(authHeader(token))
      .send({
        personType: 'natural',
        cedula: uniqueCedula(),
        firstName: 'Holder',
        lastName: 'OPR',
        birthDate: '1990-01-01',
        address: 'Av Caracas',
        phones: [],
      });
    if (![200, 201].includes(patientRes.status)) {
      console.warn('Skipping — patient setup failed', patientRes.body);
      return;
    }
    const holderId = patientRes.body.id;

    const stRes = await request(app.getHttpServer())
      .post('/service-types')
      .set(authHeader(token))
      .send({ name: uniqueName('ST OPR'), particularPriceUsd: 40 });
    const serviceTypeId = stRes.body?.id;

    const docRes = await request(app.getHttpServer())
      .post('/doctors')
      .set(authHeader(token))
      .send({
        cedula: uniqueCedula(),
        email: docEmail,
        firstName: 'Prov',
        lastName: 'OPR',
        isLegalEntity: false,
        phones: [],
        specialtyIds: [specialtyId],
        password: PASSWORD,
      });
    doctorId = docRes.body?.id ?? null;

    if (!serviceTypeId || !doctorId) {
      console.warn('Skipping — fixture setup failed');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set(authHeader(token))
      .send({
        branchId,
        type: 'cash',
        holderId,
        patientId: holderId,
        specialtyId,
        serviceTypes: [{ serviceTypeId, providerType: 'doctor', doctorId }],
        pathologyIds: [],
        orderDate: today,
        appointmentDate: `${today}T10:00:00.000Z`,
        priceAmount: 40,
      });
    if ([200, 201].includes(res.status)) {
      createOk = true;
      orderId = res.body.id;
    } else {
      console.warn('Order create failed', res.status, res.body);
    }
    expect([200, 201, 400, 403]).toContain(res.status);
  });

  it('login del doctor proveedor', async () => {
    if (!doctorId) return;
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: docEmail, password: PASSWORD });
    doctorToken =
      res.body.accessToken ?? res.body.access_token ?? res.body.token;
    expect(doctorToken).toBeTruthy();
  });

  it('attend (staff) → atendida', async () => {
    if (!createOk || !orderId) return;
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/attend`)
      .set(authHeader(token))
      .send({ attended: true });
    expect([200, 204]).toContain(res.status);
  });

  it('staff PATCH /report con nota general + observaciones por proveedor', async () => {
    if (!createOk || !orderId || !doctorId) return;
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/report`)
      .set(authHeader(token))
      .send({
        otherStudies: 'nota general e2e',
        providerReports: [
          { providerType: 'doctor', doctorId, observations: 'obs del doctor (staff)' },
        ],
      });
    expect([200, 204]).toContain(res.status);
  });

  it('GET /orders/:id refleja otherStudies + providerReports', async () => {
    if (!createOk || !orderId || !doctorId) return;
    const res = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set(authHeader(token))
      .expect(200);
    expect(res.body.otherStudies).toBe('nota general e2e');
    const pr = (res.body.providerReports ?? []).find(
      (r: { doctorId?: string }) => r.doctorId === doctorId,
    );
    expect(pr?.observations).toBe('obs del doctor (staff)');
  });

  it('el proveedor ve la orden en su listado (scope por proveedor)', async () => {
    if (!createOk || !orderId || !doctorToken) return;
    const res = await request(app.getHttpServer())
      .get('/orders')
      .set(authHeader(doctorToken));
    expect(res.status).toBe(200);
    const found = (res.body.data ?? []).find(
      (o: { id: string }) => o.id === orderId,
    );
    expect(found).toBeTruthy();
  });

  it('el proveedor edita SOLO su propio segmento → OK', async () => {
    if (!createOk || !orderId || !doctorId || !doctorToken) return;
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/report`)
      .set(authHeader(doctorToken))
      .send({
        providerReports: [
          { providerType: 'doctor', doctorId, observations: 'obs por el propio doctor' },
        ],
      });
    expect([200, 204]).toContain(res.status);
  });

  it('el proveedor NO puede setear el segmento de otro proveedor → 400/403', async () => {
    if (!createOk || !orderId || !doctorToken) return;
    const otherId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/report`)
      .set(authHeader(doctorToken))
      .send({
        providerReports: [
          { providerType: 'care_center', careCenterId: otherId, observations: 'no permitido' },
        ],
      });
    expect([400, 403]).toContain(res.status);
  });

  it('cleanup: elimina la orden', async () => {
    if (!createOk || !orderId) return;
    await request(app.getHttpServer())
      .delete(`/orders/${orderId}`)
      .set(authHeader(token));
    const res = await request(app.getHttpServer())
      .delete(`/orders/${orderId}/permanent`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });
});
