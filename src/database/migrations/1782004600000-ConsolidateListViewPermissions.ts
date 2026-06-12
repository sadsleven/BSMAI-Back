import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsolidateListViewPermissions1782004600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // For each role that has a `.view` permission, ensure it also has the matching `.list` permission.
    await queryRunner.query(`
      INSERT INTO "roles_permissions" ("roleId", "permissionId")
      SELECT rp."roleId", p_list."id"
      FROM "roles_permissions" rp
      INNER JOIN "permissions" p_view ON p_view."id" = rp."permissionId"
      INNER JOIN "permissions" p_list
        ON p_list."resource" = p_view."resource"
       AND p_list."action" = 'list'
      WHERE p_view."action" = 'view'
        AND p_view."name" <> 'app-config.view'
        AND NOT EXISTS (
          SELECT 1 FROM "roles_permissions" existing
          WHERE existing."roleId" = rp."roleId"
            AND existing."permissionId" = p_list."id"
        )
    `);

    // Drop roles_permissions rows referencing obsolete .view permissions.
    await queryRunner.query(`
      DELETE FROM "roles_permissions" rp
      USING "permissions" p
      WHERE p."id" = rp."permissionId"
        AND p."action" = 'view'
        AND p."name" <> 'app-config.view'
    `);

    // Remove obsolete .view rows from permissions catalog.
    await queryRunner.query(`
      DELETE FROM "permissions"
      WHERE "action" = 'view' AND "name" <> 'app-config.view'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-create .view permissions for each resource that has a .list.
    await queryRunner.query(`
      INSERT INTO "permissions" ("name", "resource", "action", "description", "label", "group")
      SELECT
        p."resource" || '.view',
        p."resource",
        'view',
        'Permite ver el detalle de un registro',
        'Ver detalle',
        p."group"
      FROM "permissions" p
      WHERE p."action" = 'list'
        AND NOT EXISTS (
          SELECT 1 FROM "permissions" v
          WHERE v."resource" = p."resource" AND v."action" = 'view'
        )
    `);

    // Grant .view to every role that already has the matching .list.
    await queryRunner.query(`
      INSERT INTO "roles_permissions" ("roleId", "permissionId")
      SELECT rp."roleId", p_view."id"
      FROM "roles_permissions" rp
      INNER JOIN "permissions" p_list ON p_list."id" = rp."permissionId" AND p_list."action" = 'list'
      INNER JOIN "permissions" p_view
        ON p_view."resource" = p_list."resource" AND p_view."action" = 'view'
      WHERE NOT EXISTS (
        SELECT 1 FROM "roles_permissions" existing
        WHERE existing."roleId" = rp."roleId" AND existing."permissionId" = p_view."id"
      )
    `);
  }
}
