import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `exchange_rates.effectiveDate` upgraded from `date` to `timestamptz` so the
 * effective hour matters (tasas can change mid-day, not just per calendar day).
 */
export class ExchangeRateEffectiveDateTimestamp1782001400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exchange_rates"
       ALTER COLUMN "effectiveDate" TYPE timestamptz
       USING "effectiveDate"::timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exchange_rates"
       ALTER COLUMN "effectiveDate" TYPE date
       USING "effectiveDate"::date`,
    );
  }
}
