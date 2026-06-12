import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authHeader } from './auth';
import { uniqueName } from './unique';

/**
 * Devuelve una especialidad asignable de la DB. Si no hay ninguna, crea una
 * nueva. Útil para tests de Doctores/Centros que requieren ≥1 especialidad.
 */
export async function ensureSpecialty(
  app: INestApplication,
  token: string,
): Promise<{ id: string }> {
  const list = await request(app.getHttpServer())
    .get('/specialties/assignable')
    .set(authHeader(token));
  if (list.status === 200 && Array.isArray(list.body) && list.body.length > 0) {
    return { id: list.body[0].id };
  }
  const created = await request(app.getHttpServer())
    .post('/specialties')
    .set(authHeader(token))
    .send({ name: uniqueName('Fix Esp'), description: 'fixture' });
  if (![200, 201].includes(created.status)) {
    throw new Error(
      `ensureSpecialty failed (${created.status}): ${JSON.stringify(created.body)}`,
    );
  }
  return { id: created.body.id };
}

/**
 * Devuelve una sucursal asignable. Crea una si no hay. Necesaria para órdenes.
 */
export async function ensureBranch(
  app: INestApplication,
  token: string,
): Promise<{ id: string }> {
  const list = await request(app.getHttpServer())
    .get('/branches/assignable')
    .set(authHeader(token));
  if (list.status === 200 && Array.isArray(list.body) && list.body.length > 0) {
    return { id: list.body[0].id };
  }
  const created = await request(app.getHttpServer())
    .post('/branches')
    .set(authHeader(token))
    .send({ name: uniqueName('Fix Sucursal'), description: 'fixture' });
  if (![200, 201].includes(created.status)) {
    throw new Error(
      `ensureBranch failed (${created.status}): ${JSON.stringify(created.body)}`,
    );
  }
  return { id: created.body.id };
}
