import { Transform, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class QueryTaxUnitsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['effectiveDate', 'amountBs', 'createdAt', 'updatedAt'])
  sortBy?: 'effectiveDate' | 'amountBs' | 'createdAt' | 'updatedAt' =
    'effectiveDate';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  sortDir?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsDateString()
  effectiveDateFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveDateTo?: string;

  @IsOptional()
  @IsBooleanString()
  withDeleted?: string;

  @IsOptional()
  @IsBooleanString()
  onlyDeleted?: string;

  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
