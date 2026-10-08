import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryBudgetsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  /** N° de presupuesto, paciente, titular, cédula/RIF o seguro. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['particular', 'insurance'])
  type?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsISO8601()
  budgetDateFrom?: string;

  @IsOptional()
  @IsISO8601()
  budgetDateTo?: string;

  /** 'true' → sólo vencidos; 'false' → sólo vigentes. Omitido → todos. */
  @IsOptional()
  @Transform(({ value }) => String(value))
  expired?: string;

  /** 'true' → sólo convertidos en orden; 'false' → sólo sin convertir. */
  @IsOptional()
  @Transform(({ value }) => String(value))
  converted?: string;

  @IsOptional()
  @IsIn([
    'budgetNumber',
    'budgetDate',
    'validUntilDate',
    'priceAmount',
    'createdAt',
    'updatedAt',
  ])
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC';

  @IsOptional()
  @Transform(({ value }) => String(value))
  withDeleted?: string;

  @IsOptional()
  @Transform(({ value }) => String(value))
  onlyDeleted?: string;
}
