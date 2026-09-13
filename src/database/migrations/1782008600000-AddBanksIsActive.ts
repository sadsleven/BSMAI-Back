import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo de bancos administrable.
 *
 * `banks.isActive boolean NOT NULL DEFAULT true`.
 *
 * Los bancos pasan de catálogo read-only (seed) a administrable desde la UI
 * (crear/editar/habilitar). No hay borrado: un banco referenciado por código
 * en métodos de pago o cuentas bancarias se deshabilita para que deje de
 * aparecer como opción en formularios, sin romper las referencias existentes.
 *
 * Idempotente vía IF NOT EXISTS.
 */
export class AddBanksIsActive1782008600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "banks"
         ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "banks" DROP COLUMN IF EXISTS "isActive"`,
    );
  }
}
