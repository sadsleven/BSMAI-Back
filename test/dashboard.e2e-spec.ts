import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapApp, closeApp } from './helpers/setup';
import { authHeader, loginAsSuperAdmin } from './helpers/auth';

const ENDPOINTS = [
  'patients-active-count',
  'orders-today-count',
  'orders-pending-count',
  'billed-month-usd',
  'collected-month-usd',
  'receivable-total-usd',
  'payable-total-usd',
];

describe('DashboardController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await bootstrapApp();
    token = await loginAsSuperAdmin(app);
  });

  afterAll(async () => {
    await closeApp(app);
  });

  for (const path of ENDPOINTS) {
    it(`GET /dashboard/${path} → 401 sin token`, async () => {
      await request(app.getHttpServer()).get(`/dashboard/${path}`).expect(401);
    });

    it(`GET /dashboard/${path} → 200 con token`, async () => {
      await request(app.getHttpServer())
        .get(`/dashboard/${path}`)
        .set(authHeader(token))
        .expect(200);
    });
  }
});
