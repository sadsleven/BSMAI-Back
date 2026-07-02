import { MigrationInterface, QueryRunner } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Estandariza los nombres de `service_types` (baremos) según el reporte aprobado
 * `ESTANDARIZACION-BAREMOS.md` (parseado a `*.data.json` por
 * `scripts/gen-baremos-standardization.cjs`).
 *
 * Por el índice UNIQUE(name) no se puede "renombrar a un nombre ya existente":
 * cada grupo se FUSIONA en una fila sobreviviente y se repuntan las 5 tablas que
 * referencian `serviceTypeId`:
 *   order_service_types, order_service_pricing,
 *   insurance_/doctor_/care_center_service_prices.
 * AP / cuentas por cobrar / impuestos NO referencian `service_types` (cuelgan de
 * `orders`), así que las órdenes quedan intactas y esos módulos no se tocan.
 * Sólo si se BORRA un service_type usado por órdenes (caso defensivo; hoy 0) se
 * limpia la cadena orden → AP/AR/impuestos.
 *
 * Sobreviviente = fila con más referencias (precios + órdenes); empate → más
 * antigua. Conflicto de precio (mismo actor en 2 filas del grupo) según
 * `priceConflictRule`: 'survivor' (default) | 'highest' | 'recent'.
 *
 * Backups: `_bkp_std_*` de las 6 tablas afectadas → `down()` restaura el estado.
 * RECOMENDADO: respaldo completo (pg_dump) antes de correr, por ser destructiva.
 */

type Data = {
  priceConflictRule: 'survivor' | 'highest' | 'recent';
  hardDelete: boolean;
  deletes: string[];
  groups: { canonical: string; variants: string[] }[];
};

const CLEAN = `btrim(regexp_replace(name, '[[:cntrl:]]', '', 'g'))`;

const PRICE_TABLES: Array<[string, string]> = [
  ['insurance_service_prices', 'insuranceId'],
  ['doctor_service_prices', 'doctorId'],
  ['care_center_service_prices', 'careCenterId'],
];

const BACKUP_TABLES = [
  'service_types',
  'insurance_service_prices',
  'doctor_service_prices',
  'care_center_service_prices',
  'order_service_types',
  'order_service_pricing',
];

export class StandardizeServiceTypeNames1782007200000
  implements MigrationInterface
{
  private loadData(): Data {
    const raw = readFileSync(
      join(__dirname, '1782007200000-StandardizeServiceTypeNames.data.json'),
      'utf8',
    );
    return JSON.parse(raw) as Data;
  }

  private async chooseSurvivor(
    qr: QueryRunner,
    ids: string[],
  ): Promise<string> {
    const rows = await qr.query(
      `SELECT st.id FROM service_types st
       WHERE st.id = ANY($1::uuid[])
       ORDER BY (
         (SELECT count(*) FROM insurance_service_prices p WHERE p."serviceTypeId" = st.id) +
         (SELECT count(*) FROM doctor_service_prices p WHERE p."serviceTypeId" = st.id) +
         (SELECT count(*) FROM care_center_service_prices p WHERE p."serviceTypeId" = st.id) +
         (SELECT count(*) FROM order_service_types p WHERE p."serviceTypeId" = st.id)
       ) DESC, st."createdAt" ASC, st.id ASC
       LIMIT 1`,
      [ids],
    );
    return rows[0].id;
  }

  /** Repunta todas las referencias de `loser` a `survivor` y borra `loser`. */
  private async merge(
    qr: QueryRunner,
    survivor: string,
    loser: string,
    rule: Data['priceConflictRule'],
  ): Promise<void> {
    for (const [tbl, actor] of PRICE_TABLES) {
      // resolver conflicto (actor presente en survivor y loser) antes de repuntar
      if (rule === 'highest') {
        await qr.query(
          `UPDATE "${tbl}" s SET "priceUsd" = GREATEST(s."priceUsd", l."priceUsd"), "updatedAt" = now()
           FROM "${tbl}" l
           WHERE s."serviceTypeId" = $1 AND l."serviceTypeId" = $2 AND s."${actor}" = l."${actor}"`,
          [survivor, loser],
        );
      } else if (rule === 'recent') {
        await qr.query(
          `UPDATE "${tbl}" s SET "priceUsd" = l."priceUsd", "updatedAt" = now()
           FROM "${tbl}" l
           WHERE s."serviceTypeId" = $1 AND l."serviceTypeId" = $2 AND s."${actor}" = l."${actor}"
             AND l."updatedAt" > s."updatedAt"`,
          [survivor, loser],
        );
      }
      // descartar los precios del loser que chocan con el survivor
      await qr.query(
        `DELETE FROM "${tbl}" l
         WHERE l."serviceTypeId" = $2
           AND EXISTS (SELECT 1 FROM "${tbl}" s WHERE s."serviceTypeId" = $1 AND s."${actor}" = l."${actor}")`,
        [survivor, loser],
      );
      // repuntar el resto
      await qr.query(
        `UPDATE "${tbl}" SET "serviceTypeId" = $1 WHERE "serviceTypeId" = $2`,
        [survivor, loser],
      );
    }

    // order_service_types — PK (orderId, serviceTypeId)
    await qr.query(
      `DELETE FROM order_service_types l
       WHERE l."serviceTypeId" = $2
         AND EXISTS (SELECT 1 FROM order_service_types s WHERE s."serviceTypeId" = $1 AND s."orderId" = l."orderId")`,
      [survivor, loser],
    );
    await qr.query(
      `UPDATE order_service_types SET "serviceTypeId" = $1 WHERE "serviceTypeId" = $2`,
      [survivor, loser],
    );

    // order_service_pricing — PK (orderId, serviceTypeId, kind)
    await qr.query(
      `DELETE FROM order_service_pricing l
       WHERE l."serviceTypeId" = $2
         AND EXISTS (SELECT 1 FROM order_service_pricing s
                     WHERE s."serviceTypeId" = $1 AND s."orderId" = l."orderId" AND s.kind = l.kind)`,
      [survivor, loser],
    );
    await qr.query(
      `UPDATE order_service_pricing SET "serviceTypeId" = $1 WHERE "serviceTypeId" = $2`,
      [survivor, loser],
    );

    // ya sin referencias → eliminar la fila perdedora
    await qr.query(`DELETE FROM service_types WHERE id = $1`, [loser]);
  }

  private async renameSurvivor(
    qr: QueryRunner,
    survivor: string,
    canonical: string,
    rule: Data['priceConflictRule'],
  ): Promise<void> {
    // si otra fila ya tiene el nombre canónico, fusionarla primero
    const conflict = await qr.query(
      `SELECT id FROM service_types WHERE name = $1 AND id <> $2`,
      [canonical, survivor],
    );
    for (const c of conflict) await this.merge(qr, survivor, c.id, rule);
    await qr.query(
      `UPDATE service_types SET name = $1, "updatedAt" = now() WHERE id = $2 AND name <> $1`,
      [canonical, survivor],
    );
  }

  /** Borra un service_type basura limpiando precios y (defensivo) cadena de órdenes. */
  private async purge(qr: QueryRunner, id: string): Promise<void> {
    for (const [tbl] of PRICE_TABLES) {
      await qr.query(`DELETE FROM "${tbl}" WHERE "serviceTypeId" = $1`, [id]);
    }
    const orders: Array<{ orderId: string }> = await qr.query(
      `SELECT DISTINCT "orderId" FROM order_service_types WHERE "serviceTypeId" = $1`,
      [id],
    );
    for (const o of orders) await this.purgeOrder(qr, o.orderId);
    await qr.query(`DELETE FROM order_service_pricing WHERE "serviceTypeId" = $1`, [
      id,
    ]);
    await qr.query(`DELETE FROM service_types WHERE id = $1`, [id]);
  }

  /** Caso defensivo: borra una orden y limpia AP/AR/impuestos que dependían de ella. */
  private async purgeOrder(qr: QueryRunner, orderId: string): Promise<void> {
    const ap = await qr.query(
      `SELECT DISTINCT ap.id FROM accounts_payable ap
       JOIN accounts_payable_orders apo ON apo."payableId" = ap.id
       JOIN order_internal_orders io ON io.id = apo."internalOrderId"
       WHERE io."orderId" = $1`,
      [orderId],
    );
    const ar = await qr.query(
      `SELECT DISTINCT ar.id FROM accounts_receivable ar
       JOIN accounts_receivable_orders aro ON aro."receivableId" = ar.id
       WHERE aro."orderId" = $1`,
      [orderId],
    );
    const taxBatches = await qr.query(
      `SELECT DISTINCT t."taxPaymentBatchId" AS id FROM taxes_payable t
       WHERE t."taxPaymentBatchId" IS NOT NULL AND t."sourcePayableId" = ANY($1::uuid[])`,
      [ap.map((r: { id: string }) => r.id)],
    );
    // borra la orden → CASCADE limpia order_internal_orders, order_service_*,
    // order_payments, order_pathologies, order_provider_reports y los pivotes AP/AR
    await qr.query(`DELETE FROM orders WHERE id = $1`, [orderId]);
    // batches que quedaron vacíos
    for (const r of ap) {
      await qr.query(
        `DELETE FROM accounts_payable WHERE id = $1
         AND NOT EXISTS (SELECT 1 FROM accounts_payable_orders o WHERE o."payableId" = $1)`,
        [r.id],
      );
    }
    for (const r of ar) {
      await qr.query(
        `DELETE FROM accounts_receivable WHERE id = $1
         AND NOT EXISTS (SELECT 1 FROM accounts_receivable_orders o WHERE o."receivableId" = $1)`,
        [r.id],
      );
    }
    for (const r of taxBatches) {
      await qr.query(
        `DELETE FROM tax_payment_batches WHERE id = $1
         AND NOT EXISTS (SELECT 1 FROM taxes_payable t WHERE t."taxPaymentBatchId" = $1)`,
        [r.id],
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const data = this.loadData();
    const rule = data.priceConflictRule ?? 'survivor';

    // 0) Backups para reversibilidad
    for (const t of BACKUP_TABLES) {
      await queryRunner.query(`DROP TABLE IF EXISTS "_bkp_std_${t}"`);
      await queryRunner.query(
        `CREATE TABLE "_bkp_std_${t}" AS SELECT * FROM "${t}"`,
      );
    }

    // 1) Limpieza de caracteres invisibles: colapsar gemelos por nombre limpio
    const twins: Array<{ ids: string[] }> = await queryRunner.query(
      `SELECT array_agg(id) AS ids
       FROM service_types
       WHERE "deletedAt" IS NULL
       GROUP BY ${CLEAN}
       HAVING count(*) > 1`,
    );
    for (const t of twins) {
      const survivor = await this.chooseSurvivor(queryRunner, t.ids);
      for (const loser of t.ids.filter((x) => x !== survivor)) {
        await this.merge(queryRunner, survivor, loser, rule);
      }
    }
    // normalizar el nombre de las filas restantes (quitar control chars)
    await queryRunner.query(
      `UPDATE service_types SET name = ${CLEAN}, "updatedAt" = now()
       WHERE name <> ${CLEAN} AND "deletedAt" IS NULL`,
    );

    // 2) Borrar basura
    let purged = 0;
    for (const name of data.deletes) {
      const rows = await queryRunner.query(
        `SELECT id FROM service_types WHERE name = $1`,
        [name],
      );
      for (const r of rows) {
        await this.purge(queryRunner, r.id);
        purged++;
      }
    }

    // 3) Fusionar grupos y renombrar al canónico
    let merged = 0;
    let losersDeleted = 0;
    for (const g of data.groups) {
      const rows = await queryRunner.query(
        `SELECT DISTINCT id FROM service_types
         WHERE "deletedAt" IS NULL
           AND (${CLEAN} = ANY($1::text[]) OR name = ANY($1::text[]) OR name = $2)`,
        [g.variants, g.canonical],
      );
      const ids: string[] = rows.map((r: { id: string }) => r.id);
      if (ids.length === 0) continue;
      const survivor = await this.chooseSurvivor(queryRunner, ids);
      for (const loser of ids.filter((x) => x !== survivor)) {
        await this.merge(queryRunner, survivor, loser, rule);
        losersDeleted++;
      }
      await this.renameSurvivor(queryRunner, survivor, g.canonical, rule);
      merged++;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[StandardizeServiceTypeNames] regla=${rule} grupos=${merged} perdedores_borrados=${losersDeleted} basura_borrada=${purged}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaura desde los backups creados en up() (revierte fusiones, renombres y borrados).
    for (const t of BACKUP_TABLES) {
      const exists = await queryRunner.query(
        `SELECT to_regclass($1) AS t`,
        [`public._bkp_std_${t}`],
      );
      if (!exists[0].t) {
        throw new Error(
          `No existe el backup "_bkp_std_${t}"; no se puede revertir automáticamente.`,
        );
      }
    }
    // vaciar dependientes y service_types (en orden FK-safe), luego recargar
    await queryRunner.query(`DELETE FROM insurance_service_prices`);
    await queryRunner.query(`DELETE FROM doctor_service_prices`);
    await queryRunner.query(`DELETE FROM care_center_service_prices`);
    await queryRunner.query(`DELETE FROM order_service_pricing`);
    await queryRunner.query(`DELETE FROM order_service_types`);
    await queryRunner.query(`DELETE FROM service_types`);

    await queryRunner.query(
      `INSERT INTO service_types SELECT * FROM "_bkp_std_service_types"`,
    );
    await queryRunner.query(
      `INSERT INTO order_service_types SELECT * FROM "_bkp_std_order_service_types"`,
    );
    await queryRunner.query(
      `INSERT INTO order_service_pricing SELECT * FROM "_bkp_std_order_service_pricing"`,
    );
    await queryRunner.query(
      `INSERT INTO insurance_service_prices SELECT * FROM "_bkp_std_insurance_service_prices"`,
    );
    await queryRunner.query(
      `INSERT INTO doctor_service_prices SELECT * FROM "_bkp_std_doctor_service_prices"`,
    );
    await queryRunner.query(
      `INSERT INTO care_center_service_prices SELECT * FROM "_bkp_std_care_center_service_prices"`,
    );

    for (const t of BACKUP_TABLES) {
      await queryRunner.query(`DROP TABLE IF EXISTS "_bkp_std_${t}"`);
    }
  }
}
