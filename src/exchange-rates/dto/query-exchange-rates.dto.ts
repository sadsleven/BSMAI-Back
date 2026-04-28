import { Transform, Type } from 'class-transformer';
import { IsBooleanString, IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CURRENCIES, Currency } from '../entities/exchange-rate.entity';

export class QueryExchangeRatesDto {
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
  @IsIn(['effectiveDate', 'amountBs', 'currency', 'createdAt', 'updatedAt'])
  sortBy?: 'effectiveDate' | 'amountBs' | 'currency' | 'createdAt' | 'updatedAt' = 'effectiveDate';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  sortDir?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;

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
