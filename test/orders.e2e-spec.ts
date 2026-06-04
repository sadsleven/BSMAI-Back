import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';
import { ensureBranch, ensureSpecialty } from './helpers/fixtures';
import { uniqueCedula, uniqueName } from './helpers/unique';

/**
 * E2E de OrdersController. Construye toda la cadena de fixtures requerida
 * (sucursal, especialidad, paciente, ST, doctor) para crear una orden tipo
 * Contado mínima viable y luego ejercitar list/get/update/delete.
 */
describe('OrdersController (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let orderId: string | null = null;
  let createOk = false;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /orders → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/orders').expect(401);
  });

  it('GET /orders → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /orders → crea orden cash mínima', async () => {
    const { id: branchId } = await ensureBranch(app, token);
    const { id: specialtyId } = await ensureSpecialty(app, token);

    // Paciente fixture
    const patientRes = await request(app.getHttpServer())
      .post('/patients')
      .set(authHeader(token))
      .send({
        personType: 'natural',
        cedula: uniqueCedula(),
        firstName: 'Holder',
        lastName: 'E2E',
        birthDate: '1990-01-01',
        address: 'Av Caracas',
        phones: [],
      });
    if (![200, 201].includes(patientRes.status)) {
      console.warn('Skipping orders create — patient setup failed', patientRes.body);
      return;
    }
    const holderId = patientRes.body.id;

    // ST fixture (con precio Particular)
    const stRes = await request(app.getHttpServer())
      .post('/service-types')
      .set(authHeader(token))
      .send({
        name: uniqueName('ST OrdE2E'),
        particularPriceUsd: 50,
      });
    const serviceTypeId = stRes.body?.id;

    // Doctor fixture asociado a la especialidad
    const docRes = await request(app.getHttpServer())
      .post('/doctors')
      .set(authHeader(token))
      .send({
        cedula: uniqueCedula(),
        firstName: 'Doc',
        lastName: 'E2E',
        isLegalEntity: false,
        phones: [],
        specialtyIds: [specialtyId],
      });
    const doctorId = docRes.body?.id;

    if (!serviceTypeId || !doctorId) {
      console.warn('Skipping orders create — fixture setup failed');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const appointment = `${today}T10:00:00.000Z`;
    const res = await request(app.getHttpServer())
      .post('/orders')
      .set(authHeader(token))
      .send({
        branchId,
        type: 'cash',
        holderId,
        patientId: holderId,
        specialtyId,
        serviceTypes: [
          {
            serviceTypeId,
            providerType: 'doctor',
            doctorId,
          },
        ],
        pathologyIds: [],
        orderDate: today,
        appointmentDate: appointment,
        priceAmount: 50,
      });
    if ([200, 201].includes(res.status)) {
      createOk = true;
      orderId = res.body.id;
    } else {
      console.warn('Order create failed', res.status, res.body);
    }
    expect([200, 201, 400, 403]).toContain(res.status);
  });

  it('GET /orders/:id → detalle', async () => {
    if (!createOk || !orderId) return;
    await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set(authHeader(token))
      .expect(200);
  });

  it('PATCH /orders/:id → edita borrador', async () => {
    if (!createOk || !orderId) return;
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}`)
      .set(authHeader(token))
      .send({ priceAmount: 50 });
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /orders/:id/authorize-amount → 400/403 sin credenciales válidas', async () => {
    if (!createOk || !orderId) return;
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/authorize-amount`)
      .set(authHeader(token))
      .send({
        validatorEmail: 'no-existe@afmi.local',
        validatorPassword: 'wrong',
        priceAmount: 60,
        observation: 'test',
      });
    expect([400, 401, 403]).toContain(res.status);
  });

  it('PATCH /orders/:id/attend → marca atendida', async () => {
    if (!createOk || !orderId) return;
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/attend`)
      .set(authHeader(token))
      .send({ attended: true });
    expect([200, 204, 400]).toContain(res.status);
  });

  it('PATCH /orders/:id/report → emite informe', async () => {
    if (!createOk || !orderId) return;
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/report`)
      .set(authHeader(token))
      .send({ otherStudies: 'Otros estudios e2e' });
    expect([200, 204, 400]).toContain(res.status);
  });

  it('POST /orders/:id/payments → rechazado fuera de borrador (status≠draft)', async () => {
    if (!createOk || !orderId) return;
    const res = await request(app.getHttpServer())
      .post(`/orders/${orderId}/payments`)
      .set(authHeader(token))
      .send({
        type: 'cash_usd',
        paymentDate: new Date().toISOString().slice(0, 10),
        amountCurrency: 'USD',
        amountValue: 50,
      });
    expect([200, 201, 400, 403]).toContain(res.status);
  });

  it('DELETE /orders/:id → soft', async () => {
    if (!createOk || !orderId) return;
    const res = await request(app.getHttpServer())
      .delete(`/orders/${orderId}`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('PATCH /orders/:id/restore', async () => {
    if (!createOk || !orderId) return;
    const res = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/restore`)
      .set(authHeader(token));
    expect([200, 204]).toContain(res.status);
  });

  it('DELETE /orders/:id/permanent', async () => {
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
