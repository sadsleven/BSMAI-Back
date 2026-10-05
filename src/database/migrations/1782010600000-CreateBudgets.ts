import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Presupuestos de servicios — el Paso 1 de la orden como documento propio,
 * antes de que la orden exista.
 *
 *  - `budgets`: cabecera. `number bigint` es el correlativo real y
 *    `budgetNumber` su forma impresa (`P-00123`), persistida como snapshot. El
 *    UNIQUE de `number` es PARCIAL (`WHERE "deletedAt" IS NULL`): el número de
 *    uno en papelera vuelve a quedar libre, igual que en las órdenes canceladas.
 *  - `budget_service_types`: una fila por servicio presupuestado, con PK propia
 *    (el mismo ST puede repetirse con nombres/precios distintos) y
 *    `unitPriceUsd` como SNAPSHOT editable: el presupuesto entregado conserva
 *    el precio cotizado aunque después cambie el baremo. El proveedor es
 *    opcional — al presupuestar normalmente no se sabe quién atiende.
 *  - `budget_pathologies`: patologías del presupuesto (mismas que la orden, para
 *    que convertir no obligue a recapturarlas).
 *
 * `convertedOrderId` enlaza la orden nacida del presupuesto con `ON DELETE SET
 * NULL`: borrar la orden deshace el enlace, no el presupuesto.
 *
 * No hay estado `expired` almacenado: se deriva de `validUntilDate` al leer, lo
 * que evita un job que vaya caducando filas.
 */
export class CreateBudgets1782010600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "budgets" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "number" bigint NOT NULL,
         "budgetNumber" varchar(32) NOT NULL,
         "branchId" uuid NOT NULL,
         "type" varchar(16) NOT NULL,
         "status" varchar(16) NOT NULL DEFAULT 'draft',
         "holderId" uuid NOT NULL,
         "patientId" uuid NOT NULL,
         "insuranceId" uuid NULL,
         "insuranceSource" varchar(16) NULL,
         "contractorId" uuid NULL,
         "specialtyId" uuid NULL,
         "diagnosisNote" varchar(500) NULL,
         "observations" text NULL,
         "referringDoctorName" varchar(200) NULL,
         "referringSpecialtyName" varchar(200) NULL,
         "budgetDate" date NOT NULL,
         "validUntilDate" date NULL,
         "priceAmount" numeric(14,2) NOT NULL,
         "priceBaseAmount" numeric(14,2) NULL,
         "priceAdjustmentNote" varchar(500) NULL,
         "exchangeRateId" uuid NULL,
         "paymentAccountId" uuid NULL,
         "sentAt" timestamptz NULL,
         "decidedAt" timestamptz NULL,
         "rejectReason" varchar(500) NULL,
         "convertedOrderId" uuid NULL,
         "convertedAt" timestamptz NULL,
         "createdById" uuid NOT NULL,
         "createdAt" timestamptz NOT NULL DEFAULT now(),
         "updatedAt" timestamptz NOT NULL DEFAULT now(),
         "deletedAt" timestamptz NULL,
         CONSTRAINT "PK_budgets" PRIMARY KEY ("id"),
         CONSTRAINT "ck_budgets_type"
           CHECK ("type" IN ('particular', 'insurance')),
         CONSTRAINT "ck_budgets_status"
           CHECK ("status" IN ('draft', 'sent', 'approved', 'rejected')),
         CONSTRAINT "ck_budgets_insurance_source"
           CHECK ("insuranceSource" IS NULL
                  OR "insuranceSource" IN ('direct', 'via_contractor')),
         -- Los campos de seguro sólo existen en presupuestos de tipo seguro, y
         -- ahí el seguro y su origen son obligatorios.
         CONSTRAINT "ck_budgets_insurance_fields"
           CHECK (
             ("type" = 'insurance'
               AND "insuranceId" IS NOT NULL AND "insuranceSource" IS NOT NULL)
             OR ("type" = 'particular'
               AND "insuranceId" IS NULL AND "insuranceSource" IS NULL
               AND "contractorId" IS NULL)
           ),
         -- 'via_contractor' exige contratista; 'direct' lo prohíbe.
         CONSTRAINT "ck_budgets_contractor_xor"
           CHECK (
             "insuranceSource" IS NULL
             OR ("insuranceSource" = 'via_contractor' AND "contractorId" IS NOT NULL)
             OR ("insuranceSource" = 'direct' AND "contractorId" IS NULL)
           ),
         CONSTRAINT "ck_budgets_reject_reason"
           CHECK ("status" <> 'rejected' OR "rejectReason" IS NOT NULL),
         CONSTRAINT "FK_budgets_branch"
           FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_budgets_holder"
           FOREIGN KEY ("holderId") REFERENCES "patients"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_budgets_patient"
           FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_budgets_insurance"
           FOREIGN KEY ("insuranceId") REFERENCES "insurances"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_budgets_contractor"
           FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_budgets_specialty"
           FOREIGN KEY ("specialtyId") REFERENCES "specialties"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_budgets_exchange_rate"
           FOREIGN KEY ("exchangeRateId") REFERENCES "exchange_rates"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_budgets_payment_account"
           FOREIGN KEY ("paymentAccountId") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_budgets_converted_order"
           FOREIGN KEY ("convertedOrderId") REFERENCES "orders"("id") ON DELETE SET NULL,
         CONSTRAINT "FK_budgets_created_by"
           FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT
       )`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_budgets_number_active"
         ON "budgets" ("number") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_budgets_branch" ON "budgets" ("branchId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_budgets_patient" ON "budgets" ("patientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_budgets_holder" ON "budgets" ("holderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_budgets_status" ON "budgets" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_budgets_date" ON "budgets" ("budgetDate")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "budget_service_types" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "budgetId" uuid NOT NULL,
         "serviceTypeId" uuid NOT NULL,
         "specialtyId" uuid NULL,
         "customName" varchar(300) NOT NULL,
         "quantity" integer NOT NULL DEFAULT 1,
         "unitPriceUsd" numeric(14,2) NOT NULL,
         "catalogPriceUsd" numeric(14,2) NULL,
         "providerType" varchar(16) NULL,
         "doctorId" uuid NULL,
         "careCenterId" uuid NULL,
         "position" integer NOT NULL DEFAULT 0,
         "createdAt" timestamptz NOT NULL DEFAULT now(),
         "updatedAt" timestamptz NOT NULL DEFAULT now(),
         CONSTRAINT "PK_budget_service_types" PRIMARY KEY ("id"),
         CONSTRAINT "ck_bst_quantity" CHECK ("quantity" >= 1),
         CONSTRAINT "ck_bst_unit_price" CHECK ("unitPriceUsd" >= 0),
         -- El proveedor es opcional, pero si se indica debe ser coherente:
         -- 'doctor' ⇒ sólo doctorId; 'care_center' ⇒ sólo careCenterId.
         CONSTRAINT "ck_bst_provider_xor"
           CHECK (
             ("providerType" IS NULL AND "doctorId" IS NULL AND "careCenterId" IS NULL)
             OR ("providerType" = 'doctor'
                 AND "doctorId" IS NOT NULL AND "careCenterId" IS NULL)
             OR ("providerType" = 'care_center'
                 AND "careCenterId" IS NOT NULL AND "doctorId" IS NULL)
           ),
         CONSTRAINT "FK_bst_budget"
           FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_bst_service_type"
           FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_bst_specialty"
           FOREIGN KEY ("specialtyId") REFERENCES "specialties"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_bst_doctor"
           FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT,
         CONSTRAINT "FK_bst_care_center"
           FOREIGN KEY ("careCenterId") REFERENCES "care_centers"("id") ON DELETE RESTRICT
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_bst_budget" ON "budget_service_types" ("budgetId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_bst_serviceType" ON "budget_service_types" ("serviceTypeId")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "budget_pathologies" (
         "budgetId" uuid NOT NULL,
         "pathologyId" uuid NOT NULL,
         CONSTRAINT "PK_budget_pathologies" PRIMARY KEY ("budgetId", "pathologyId"),
         CONSTRAINT "FK_budget_pathologies_budget"
           FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE,
         CONSTRAINT "FK_budget_pathologies_pathology"
           FOREIGN KEY ("pathologyId") REFERENCES "pathologies"("id") ON DELETE CASCADE
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_budget_pathologies_pathology"
         ON "budget_pathologies" ("pathologyId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "budget_pathologies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budget_service_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "budgets"`);
  }
}
