import { Transform, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryPaymentAccountsDto {
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
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['mobile_payment', 'bank_transfer', 'card', 'other'])
  type?: 'mobile_payment' | 'bank_transfer' | 'card' | 'other';

  @IsOptional()
  @IsIn(['name', 'type', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'type' | 'createdAt' | 'updatedAt' = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  sortDir?: 'ASC' | 'DESC' = 'DESC';

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

export class AssignablePaymentAccountsQueryDto {
  @IsOptional()
  @IsIn(['mobile_payment', 'bank_transfer', 'card', 'other'])
  type?: 'mobile_payment' | 'bank_transfer' | 'card' | 'other';
}
