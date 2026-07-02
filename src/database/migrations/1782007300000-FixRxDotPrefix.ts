import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normaliza el prefijo de radiografías: `RX.` → `RX ` (convención del baremo) en
 * los `service_types` sueltos que no entraron en un grupo de la estandarización
 * (ej. `RX.PIELOGRAFIA` → `RX PIELOGRAFIA`). Son estudios distintos: solo se
 * corrige el prefijo, no se fusiona. Se valida que el destino esté libre.
 *
 * Backup `_bkp_rxdot(id, oldname)` → `down()` restaura los nombres originales.
 */
export class FixRxDotPrefix1782007300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "_bkp_rxdot"`);
    await queryRunner.query(
      `CREATE TABLE "_bkp_rxdot" AS
       SELECT id, name AS oldname FROM service_types WHERE name LIKE 'RX.%'`,
    );
    await queryRunner.query(
      `UPDATE service_types st
       SET name = regexp_replace(name, '^RX\\.\\s*', 'RX '), "updatedAt" = now()
       WHERE name LIKE 'RX.%'
         AND NOT EXISTS (
           SELECT 1 FROM service_types s2
           WHERE s2.id <> st.id
             AND s2.name = regexp_replace(st.name, '^RX\\.\\s*', 'RX ')
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(
      `SELECT to_regclass('public._bkp_rxdot') AS t`,
    );
    if (!exists[0].t) return;
    await queryRunner.query(
      `UPDATE service_types st SET name = b.oldname, "updatedAt" = now()
       FROM "_bkp_rxdot" b WHERE st.id = b.id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "_bkp_rxdot"`);
  }
}
