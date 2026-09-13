import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige el nombre del tipo de servicio "CHLAMYDIA TRACOMATI IGG".
 *
 * El catálogo tiene el par asimétrico "CHLAMYDIA TRACHOMATIS IgM" (bien
 * escrito) y "CHLAMYDIA TRACOMATI IGG" (typo). Al incorporar el baremo de
 * Oceánica ("CHLAMYDIA TRACHOMATIS ANTICUERPOS IGG EIA") el alias tenía que
 * apuntar al nombre mal escrito para no duplicar el tipo de servicio; se
 * arregla el nombre y el alias apunta al correcto.
 *
 * Sólo cambia `service_types.name`: las referencias son por id (precios,
 * órdenes) y el nombre por orden queda congelado en
 * `order_service_types.customName`, así que nada histórico se altera.
 *
 * Idempotente y no destructiva: si el nombre destino ya existe no hace nada
 * (evita chocar contra el UNIQUE de `name`).
 */
const WRONG = 'CHLAMYDIA TRACOMATI IGG';
const RIGHT = 'CHLAMYDIA TRACHOMATIS IgG';

async function rename(
  queryRunner: QueryRunner,
  from: string,
  to: string,
): Promise<void> {
  await queryRunner.query(
    `UPDATE "service_types" SET "name" = $2
       WHERE "name" = $1
         AND NOT EXISTS (SELECT 1 FROM "service_types" s WHERE s."name" = $2)`,
    [from, to],
  );
}

export class FixChlamydiaTrachomatisIggName1782008800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await rename(queryRunner, WRONG, RIGHT);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await rename(queryRunner, RIGHT, WRONG);
  }
}
