import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fusiona duplicados residuales detectados al revisar los baremos (xlsx) contra
 * la estandarización: difieren sólo por espaciado/símbolo (no tilde), por lo que
 * el `normKey` del seeder no los colapsaba. Hoy:
 *   `MALARIA/PALUDISMO`            → `MALARIA / PALUDISMO`
 *   `% SATURACION DE TRANSFERRINA` → `SATURACIÓN DE TRANSFERRINA`
 *
 * El destino ya existe → se FUSIONA (repunta las 5 tablas que referencian
 * serviceTypeId y elimina el origen). Backup `_bkp_merge_residual(id, oldname)`.
 */
const RENAMES: Array<{ from: string; to: string }> = [
  { from: 'MALARIA/PALUDISMO', to: 'MALARIA / PALUDISMO' },
  { from: '% SATURACION DE TRANSFERRINA', to: 'SATURACIÓN DE TRANSFERRINA' },
];

const PRICE_TABLES: Array<[string, string]> = [
  ['insurance_service_prices', 'insuranceId'],
  ['doctor_service_prices', 'doctorId'],
  ['care_center_service_prices', 'careCenterId'],
];

export class MergeResidualDuplicates1782007500000
  implements MigrationInterface
{
  private async mergeInto(
    qr: QueryRunner,
    survivor: string,
    loser: string,
  ): Promise<void> {
    for (const [tbl, actor] of PRICE_TABLES) {
      await qr.query(
        `DELETE FROM "${tbl}" l WHERE l."serviceTypeId" = $2
           AND EXISTS (SELECT 1 FROM "${tbl}" s WHERE s."serviceTypeId" = $1 AND s."${actor}" = l."${actor}")`,
        [survivor, loser],
      );
      await qr.query(
        `UPDATE "${tbl}" SET "serviceTypeId" = $1 WHERE "serviceTypeId" = $2`,
        [survivor, loser],
      );
    }
    await qr.query(
      `DELETE FROM order_service_types l WHERE l."serviceTypeId" = $2
         AND EXISTS (SELECT 1 FROM order_service_types s WHERE s."serviceTypeId" = $1 AND s."orderId" = l."orderId")`,
      [survivor, loser],
    );
    await qr.query(
      `UPDATE order_service_types SET "serviceTypeId" = $1 WHERE "serviceTypeId" = $2`,
      [survivor, loser],
    );
    await qr.query(
      `DELETE FROM order_service_pricing l WHERE l."serviceTypeId" = $2
         AND EXISTS (SELECT 1 FROM order_service_pricing s WHERE s."serviceTypeId" = $1 AND s."orderId" = l."orderId" AND s.kind = l.kind)`,
      [survivor, loser],
    );
    await qr.query(
      `UPDATE order_service_pricing SET "serviceTypeId" = $1 WHERE "serviceTypeId" = $2`,
      [survivor, loser],
    );
    await qr.query(`DELETE FROM service_types WHERE id = $1`, [loser]);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "_bkp_merge_residual"`);
    await queryRunner.query(
      `CREATE TABLE "_bkp_merge_residual" (id uuid, oldname varchar(200))`,
    );
    for (const { from, to } of RENAMES) {
      const origin = await queryRunner.query(
        `SELECT id FROM service_types WHERE name = $1`,
        [from],
      );
      if (!origin.length) continue;
      const originId = origin[0].id;
      await queryRunner.query(
        `INSERT INTO "_bkp_merge_residual"(id, oldname) VALUES ($1, $2)`,
        [originId, from],
      );
      const target = await queryRunner.query(
        `SELECT id FROM service_types WHERE name = $1 AND id <> $2`,
        [to, originId],
      );
      if (target.length) {
        await this.mergeInto(queryRunner, target[0].id, originId);
      } else {
        await queryRunner.query(
          `UPDATE service_types SET name = $1, "updatedAt" = now() WHERE id = $2`,
          [to, originId],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(
      `SELECT to_regclass('public._bkp_merge_residual') AS t`,
    );
    if (!exists[0].t) return;
    // sólo revierte renombres (las fusiones borraron el origen, no se recrean)
    await queryRunner.query(
      `UPDATE service_types st SET name = b.oldname, "updatedAt" = now()
       FROM "_bkp_merge_residual" b WHERE st.id = b.id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "_bkp_merge_residual"`);
  }
}
