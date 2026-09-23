import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

describe('AccountsPayableController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('GET /accounts-payable → 401 sin token', async () => {
    await request(app.getHttpServer()).get('/accounts-payable').expect(401);
  });

  it('GET /accounts-payable → paginado', async () => {
    const res = await request(app.getHttpServer())
      .get('/accounts-payable')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /accounts-payable/:id → 404 con UUID inexistente', async () => {
    const res = await request(app.getHttpServer())
      .get('/accounts-payable/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token));
    expect([404, 400]).toContain(res.status);
  });

  it('POST /accounts-payable/:id/payments → 400 sin pagos', async () => {
    const res = await request(app.getHttpServer())
      .post('/accounts-payable/00000000-0000-0000-0000-000000000000/payments')
      .set(authHeader(token))
      .send({ payments: [] });
    expect([400, 422]).toContain(res.status);
  });

  /**
   * Tasa de pago del lote: el neto en Bs se calcula con la tasa elegida (no
   * con la de facturación) y cambiarla recalcula bruto Bs/retención/neto.
   * Necesita ≥1 orden interna pendiente y ≥2 tasas USD activas distintas; si
   * la BD no las tiene, el test se salta. Limpia anulando el lote al final.
   */
  it('tasa de pago del lote define y recalcula los Bs a pagar', async () => {
    const http = () => request(app.getHttpServer());
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const ratesRes = await http()
      .get('/exchange-rates')
      .query({ currency: 'USD', isActive: true, limit: 100 })
      .set(authHeader(token))
      .expect(200);
    const usdRates = (ratesRes.body.data as Array<{ id: string; amountBs: string }>)
      .map((r) => ({ id: r.id, bs: Number(r.amountBs) }))
      .filter((r) => r.bs > 0);
    const distinct = usdRates.filter(
      (r, i, arr) => arr.findIndex((x) => x.bs === r.bs) === i,
    );
    const pendingRes = await http()
      .get('/accounts-payable/pending')
      .query({ limit: 1 })
      .set(authHeader(token))
      .expect(200);
    const pending = pendingRes.body.data[0] as
      | {
          internalOrderId: string;
          providerType: 'doctor' | 'care_center';
          doctorId: string | null;
          careCenterId: string | null;
          grossUsd: number;
        }
      | undefined;
    if (distinct.length < 2 || !pending) {
      console.warn('skip: faltan tasas USD distintas u órdenes pendientes');
      return;
    }
    const [rateA, rateB] = distinct;

    // Crear el lote con tasa A (sin retención para que neto = bruto y el
    // cuadre sea exacto: grossUsd × tasa).
    const created = await http()
      .post('/accounts-payable')
      .set(authHeader(token))
      .send({
        recipientType: pending.providerType,
        doctorId: pending.providerType === 'doctor' ? pending.doctorId : undefined,
        careCenterId:
          pending.providerType === 'care_center' ? pending.careCenterId : undefined,
        applyRetention: false,
        exchangeRateId: rateA.id,
        internalOrderIds: [pending.internalOrderId],
      })
      .expect(201);
    const batchId = created.body.id as string;
    try {
      const grossUsd = Number(created.body.grossUsd);
      expect(created.body.exchangeRateId).toBe(rateA.id);
      expect(Number(created.body.grossBs)).toBeCloseTo(round2(grossUsd * rateA.bs), 2);
      expect(Number(created.body.netBs)).toBeCloseTo(round2(grossUsd * rateA.bs), 2);

      // Cambiar a tasa B ⇒ bruto Bs / neto / pendiente se recalculan.
      const patched = await http()
        .patch(`/accounts-payable/${batchId}/exchange-rate`)
        .set(authHeader(token))
        .send({ exchangeRateId: rateB.id })
        .expect(200);
      const expectedNetB = round2(grossUsd * rateB.bs);
      expect(patched.body.exchangeRateId).toBe(rateB.id);
      expect(Number(patched.body.grossBs)).toBeCloseTo(expectedNetB, 2);
      expect(Number(patched.body.netBs)).toBeCloseTo(expectedNetB, 2);
      expect(Number(patched.body.pendingBs)).toBeCloseTo(expectedNetB, 2);
      expect(Number(patched.body.netBs)).not.toBeCloseTo(
        round2(grossUsd * rateA.bs),
        2,
      );

      // Pagar exactamente el neto a tasa B ⇒ el lote queda pagado (con el
      // neto viejo a tasa A quedaría parcial o excedido).
      const paid = await http()
        .post(`/accounts-payable/${batchId}/payments`)
        .set(authHeader(token))
        .send({
          payments: [
            {
              type: 'cash_bs',
              paymentDate: '2026-01-15',
              exchangeRateId: rateB.id,
              amountCurrency: 'BS',
              amountValue: expectedNetB,
            },
          ],
        })
        .expect(201);
      expect(paid.body.status).toBe('paid');
      expect(Number(paid.body.pendingBs)).toBeCloseTo(0, 2);

      // Pagado ⇒ no se puede cambiar la tasa.
      await http()
        .patch(`/accounts-payable/${batchId}/exchange-rate`)
        .set(authHeader(token))
        .send({ exchangeRateId: rateA.id })
        .expect(400);
    } finally {
      await http()
        .delete(`/accounts-payable/${batchId}`)
        .set(authHeader(token))
        .expect(204);
    }
  });

  /**
   * Monto manual de retención: reemplaza al cálculo automático (neto = bruto −
   * monto), no puede superar el bruto, `null` vuelve al automático y queda
   * bloqueado con el lote pagado. Necesita ≥1 orden pendiente y ≥1 tasa USD
   * activa; si la BD no las tiene, el test se salta. Limpia anulando el lote.
   */
  it('monto manual de retención define el neto y se puede revertir', async () => {
    const http = () => request(app.getHttpServer());
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const ratesRes = await http()
      .get('/exchange-rates')
      .query({ currency: 'USD', isActive: true, limit: 10 })
      .set(authHeader(token))
      .expect(200);
    const rate = (ratesRes.body.data as Array<{ id: string; amountBs: string }>)
      .map((r) => ({ id: r.id, bs: Number(r.amountBs) }))
      .find((r) => r.bs > 0);
    const pendingRes = await http()
      .get('/accounts-payable/pending')
      .query({ limit: 1 })
      .set(authHeader(token))
      .expect(200);
    const pending = pendingRes.body.data[0] as
      | {
          internalOrderId: string;
          providerType: 'doctor' | 'care_center';
          doctorId: string | null;
          careCenterId: string | null;
          grossUsd: number;
        }
      | undefined;
    if (!rate || !pending) {
      console.warn('skip: faltan tasa USD u órdenes pendientes');
      return;
    }
    const grossBs = round2(Number(pending.grossUsd) * rate.bs);
    const custom = round2(grossBs * 0.01);
    const body = {
      recipientType: pending.providerType,
      doctorId: pending.providerType === 'doctor' ? pending.doctorId : undefined,
      careCenterId:
        pending.providerType === 'care_center' ? pending.careCenterId : undefined,
      applyRetention: true,
      exchangeRateId: rate.id,
      internalOrderIds: [pending.internalOrderId],
    };

    // Monto manual mayor al bruto ⇒ 400 y no se crea el lote.
    await http()
      .post('/accounts-payable')
      .set(authHeader(token))
      .send({ ...body, customRetentionBs: round2(grossBs + 1000) })
      .expect(400);

    const created = await http()
      .post('/accounts-payable')
      .set(authHeader(token))
      .send({ ...body, customRetentionBs: custom })
      .expect(201);
    const batchId = created.body.id as string;
    try {
      expect(Number(created.body.customRetentionBs)).toBeCloseTo(custom, 2);
      expect(Number(created.body.retentionBs)).toBeCloseTo(custom, 2);
      expect(Number(created.body.netBs)).toBeCloseTo(round2(grossBs - custom), 2);

      // Supera el bruto ⇒ 400.
      await http()
        .patch(`/accounts-payable/${batchId}/custom-retention`)
        .set(authHeader(token))
        .send({ customRetentionBs: round2(grossBs + 1000) })
        .expect(400);

      // null ⇒ vuelve al cálculo automático.
      const auto = await http()
        .patch(`/accounts-payable/${batchId}/custom-retention`)
        .set(authHeader(token))
        .send({ customRetentionBs: null })
        .expect(200);
      expect(auto.body.customRetentionBs).toBeNull();
      expect(Number(auto.body.netBs)).toBeCloseTo(
        round2(grossBs - Number(auto.body.retentionBs)),
        2,
      );

      // Fijar otro monto manual ⇒ neto = bruto − monto.
      const custom2 = round2(custom * 2);
      const fixed = await http()
        .patch(`/accounts-payable/${batchId}/custom-retention`)
        .set(authHeader(token))
        .send({ customRetentionBs: custom2 })
        .expect(200);
      expect(Number(fixed.body.retentionBs)).toBeCloseTo(custom2, 2);
      const expectedNet = round2(grossBs - custom2);
      expect(Number(fixed.body.netBs)).toBeCloseTo(expectedNet, 2);

      // Pagar el neto ⇒ pagado; ya no se puede cambiar el monto manual.
      const paid = await http()
        .post(`/accounts-payable/${batchId}/payments`)
        .set(authHeader(token))
        .send({
          payments: [
            {
              type: 'cash_bs',
              paymentDate: '2026-01-15',
              exchangeRateId: rate.id,
              amountCurrency: 'BS',
              amountValue: expectedNet,
            },
          ],
        })
        .expect(201);
      expect(paid.body.status).toBe('paid');
      await http()
        .patch(`/accounts-payable/${batchId}/custom-retention`)
        .set(authHeader(token))
        .send({ customRetentionBs: null })
        .expect(400);
    } finally {
      await http()
        .delete(`/accounts-payable/${batchId}`)
        .set(authHeader(token))
        .expect(204);
    }
  });
});
