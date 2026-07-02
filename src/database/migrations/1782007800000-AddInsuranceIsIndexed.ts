import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seguros indexados vs no indexados.
 *
 * `insurances.isIndexed boolean NOT NULL DEFAULT false`.
 *   - **No indexado** (false): la cuenta por cobrar se cobra a la tasa del día
 *     del cobro (modo USD flotante en AR).
 *   - **Indexado** (true): la cuenta por cobrar queda fija en Bs a la tasa del
 *     día de la orden (se asigna una tasa a la orden en el Paso 1). Reemplaza el
 *     antiguo checkbox por-orden "tasa fija": ahora `orders.useFixedRate` se
 *     deriva de este flag del seguro.
 *
 * Idempotente vía IF NOT EXISTS.
 */
export class AddInsuranceIsIndexed1782007800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances"
         ADD COLUMN IF NOT EXISTS "isIndexed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insurances" DROP COLUMN IF EXISTS "isIndexed"`,
    );
  }
}
