import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tipos de servicio indexados dentro de una orden con seguro no indexado.
 *
 * `order_service_types.isIndexed boolean NOT NULL DEFAULT false`.
 *
 * Un seguro no indexado (`insurances.isIndexed=true`, orden `useFixedRate=true`,
 * CxC fija en Bs a la tasa de la orden) puede incluir tipos de servicio que SÍ
 * son indexados: esos STs se cobran a la tasa del día del cobro, no a la tasa
 * fija de la orden. El flag se marca por fila en el Paso 1 y sólo aplica cuando
 * la orden quedó en modo tasa fija (el service lo fuerza a false en cualquier
 * otro caso).
 *
 * Idempotente vía IF NOT EXISTS.
 */
export class AddOstIsIndexed1782008300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types"
         ADD COLUMN IF NOT EXISTS "isIndexed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types" DROP COLUMN IF EXISTS "isIndexed"`,
    );
  }
}
