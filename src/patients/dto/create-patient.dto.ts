import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  CEDULA_MESSAGE,
  CEDULA_PATTERN,
  RIF_MESSAGE,
  RIF_PATTERN,
} from '../../shared/validators/ve-formats';
import { PhoneDto } from './phone.dto';
import { PERSON_TYPES, PersonType } from '../entities/patient.entity';

const NAME_PATTERN = /^[A-Za-zÀ-ÿñÑ\s]+$/;

export class CreatePatientDto {
  @IsIn(PERSON_TYPES, { message: 'El tipo de persona debe ser natural o legal_entity' })
  personType: PersonType;

  /* ---------- Persona natural ---------- */

  @ValidateIf((o) => o.personType === 'natural')
  @IsString()
  @Matches(CEDULA_PATTERN, { message: CEDULA_MESSAGE })
  cedula?: string;

  @ValidateIf((o) => o.personType === 'natural')
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @Matches(NAME_PATTERN, { message: 'El nombre solo permite letras y espacios' })
  firstName?: string;

  @ValidateIf((o) => o.personType === 'natural')
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @Matches(NAME_PATTERN, { message: 'El apellido solo permite letras y espacios' })
  lastName?: string;

  /* ---------- Persona jurídica ---------- */

  @ValidateIf((o) => o.personType === 'legal_entity')
  @IsString()
  @MinLength(1, { message: 'La razón social es obligatoria' })
  @MaxLength(200)
  businessName?: string;

  @ValidateIf((o) => o.personType === 'legal_entity')
  @IsString()
  @Matches(RIF_PATTERN, { message: RIF_MESSAGE })
  rif?: string;

  /* ---------- Comunes ---------- */

  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(200)
  email: string;

  @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  birthDate: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  address: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe ingresar al menos un teléfono' })
  @ArrayMaxSize(10, { message: 'Máximo 10 teléfonos por paciente' })
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones: PhoneDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'Máximo 50 seguros por paciente' })
  @IsUUID('all', { each: true, message: 'IDs de seguros inválidos' })
  insuranceIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'Máximo 50 contratistas por paciente' })
  @IsUUID('all', { each: true, message: 'IDs de contratistas inválidos' })
  contractorIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
