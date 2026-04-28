import { Transform, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PERSON_TYPES, PersonType } from '../entities/patient.entity';

export class QueryPatientsDto {
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
  @IsIn(['firstName', 'lastName', 'businessName', 'cedula', 'rif', 'email', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'firstName'
    | 'lastName'
    | 'businessName'
    | 'cedula'
    | 'rif'
    | 'email'
    | 'createdAt'
    | 'updatedAt' = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
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

  @IsOptional()
  @IsDateString()
  birthDateFrom?: string;

  @IsOptional()
  @IsDateString()
  birthDateTo?: string;

  @IsOptional()
  @IsString()
  insuranceId?: string;

  @IsOptional()
  @IsString()
  contractorId?: string;

  @IsOptional()
  @IsIn(PERSON_TYPES)
  personType?: PersonType;

  /**
   * Si `'true'`, restringe a pacientes con al menos un contratista y al menos un seguro
   * asignados (no eliminados/activos). Usado por el flujo de creación de orden tipo seguro.
   */
  @IsOptional()
  @IsString()
  hasInsuranceAndContractor?: string;
}
