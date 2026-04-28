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

export class QueryOrdersDto {
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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['draft', 'in_progress', 'attended', 'report_issued', 'finalized', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsIn(['cash', 'credit', 'insurance', 'cashea'])
  type?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  careCenterId?: string;

  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @IsOptional()
  @IsISO8601()
  orderDateFrom?: string;

  @IsOptional()
  @IsISO8601()
  orderDateTo?: string;

  @IsOptional()
  @IsISO8601()
  appointmentDateFrom?: string;

  @IsOptional()
  @IsISO8601()
  appointmentDateTo?: string;

  @IsOptional()
  @IsIn(['orderNumber', 'orderDate', 'appointmentDate', 'priceAmount', 'createdAt', 'updatedAt'])
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
