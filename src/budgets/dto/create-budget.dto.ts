import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BudgetServiceTypeRowDto } from './budget-service-type.dto';

export const BUDGET_TYPES = ['particular', 'insurance'] as const;
export const BUDGET_INSURANCE_SOURCES = ['direct', 'via_contractor'] as const;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateBudgetDto {
  @IsUUID()
  branchId: string;

  @IsIn(BUDGET_TYPES)
  type: 'particular' | 'insurance';

  @IsUUID()
  holderId: string;

  @IsUUID()
  patientId: string;

  /** Requerido cuando `type='insurance'`. Validado en service. */
  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  @IsOptional()
  @IsIn(BUDGET_INSURANCE_SOURCES)
  insuranceSource?: 'direct' | 'via_contractor';

  @IsOptional()
  @IsUUID()
  contractorId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un servicio' })
  @ArrayMaxSize(50, { message: 'Máximo 50 servicios' })
  @ValidateNested({ each: true })
  @Type(() => BudgetServiceTypeRowDto)
  serviceTypes: BudgetServiceTypeRowDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  pathologyIds?: string[];

  /** Diagnóstico redactado que sustituye a las patologías en el documento. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Máximo 500 caracteres' })
  diagnosisNote?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000, { message: 'Máximo 2000 caracteres' })
  observations?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200, { message: 'Máximo 200 caracteres' })
  referringDoctorName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200, { message: 'Máximo 200 caracteres' })
  referringSpecialtyName?: string;

  @IsISO8601()
  budgetDate: string;

  @IsOptional()
  @IsISO8601()
  validUntilDate?: string;

  /**
   * Total presupuestado en USD. Puede diferir de la suma de las líneas
   * (descuento o recargo global); en ese caso el service exige
   * `priceAdjustmentNote`.
   */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  priceAmount: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Máximo 500 caracteres' })
  priceAdjustmentNote?: string;

  /** Tasa USD/Bs snapshot para la plantilla PACIENTE. */
  @IsOptional()
  @IsUUID()
  exchangeRateId?: string;

  /** Cuenta propia que se imprime en la plantilla SEGUROS. */
  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;
}
