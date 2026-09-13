import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `order_service_types.customName` pasa a ser OBLIGATORIO (NOT NULL).
 *
 * Backfill de filas existentes sin nombre: se rellena con el nombre del Tipo de
 * Servicio (`service_types.name`); si por algún motivo no hubiera, con un texto
 * genérico, de modo que `SET NOT NULL` nunca falle. A partir de aquí toda fila
 * lleva su propio nombre para la orden (Paso 2: órdenes internas; Paso 4: factura).
 */
export class MakeOrderServiceTypeCustomNameRequired1782007100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Rellena con el nombre del baremo las filas sin customName.
    await queryRunner.query(`
      UPDATE "order_service_types" ost
      SET "customName" = COALESCE(NULLIF(TRIM(st."name"), ''), 'Servicio')
      FROM "service_types" st
      WHERE ost."serviceTypeId" = st."id"
        AND (ost."customName" IS NULL OR TRIM(ost."customName") = '')
    `);
    // 2) Red de seguridad: cualquier resto sin nombre (ST inexistente) → genérico.
    await queryRunner.query(`
      UPDATE "order_service_types"
      SET "customName" = 'Servicio'
      WHERE "customName" IS NULL OR TRIM("customName") = ''
    `);
    // 3) Normaliza (trim) y fija NOT NULL.
    await queryRunner.query(
      `UPDATE "order_service_types" SET "customName" = TRIM("customName")`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ALTER COLUMN "customName" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_service_types" ALTER COLUMN "customName" DROP NOT NULL`,
    );
  }
}
