import { Transform, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryDoctorsDto {
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
  @IsIn(['firstName', 'lastName', 'cedula', 'email', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'firstName'
    | 'lastName'
    | 'cedula'
    | 'email'
    | 'createdAt'
    | 'updatedAt' = 'createdAt';

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

  /** 'natural' (no jurídico) o 'legal' (jurídico). */
  @IsOptional()
  @IsIn(['natural', 'legal', 'all'])
  entityType?: 'natural' | 'legal' | 'all';

  @IsOptional()
  @IsUUID('4')
  specialtyId?: string;
}
