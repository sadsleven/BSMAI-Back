import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  PATIENT_CEDULA_MESSAGE,
  PATIENT_CEDULA_PATTERN,
  RIF_MESSAGE,
  RIF_PATTERN,
} from '../../shared/validators/ve-formats';
import { PhoneDto } from './phone.dto';
import { PERSON_TYPES, PersonType } from '../entities/patient.entity';

const NAME_PATTERN = /^[A-Za-zÀ-ÿñÑ\s]+$/;

export class CreatePatientDto {
  @IsIn(PERSON_TYPES, {
    message: 'El tipo de persona debe ser natural o legal_entity',
  })
  personType: PersonType;

  /* ---------- Persona natural ---------- */

  // Cédula opcional. Si se informa, debe respetar formato VE.
  @IsOptional()
  @ValidateIf(
    (o) => o.cedula !== undefined && o.cedula !== null && o.cedula !== '',
  )
  @IsString()
  @Matches(PATIENT_CEDULA_PATTERN, { message: PATIENT_CEDULA_MESSAGE })
  cedula?: string;

  @ValidateIf((o) => o.personType === 'natural')
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @Matches(NAME_PATTERN, {
    message: 'El nombre solo permite letras y espacios',
  })
  firstName?: string;

  @ValidateIf((o) => o.personType === 'natural')
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @Matches(NAME_PATTERN, {
    message: 'El apellido solo permite letras y espacios',
  })
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

  @IsOptional()
  @ValidateIf(
    (o) => o.email !== undefined && o.email !== null && o.email !== '',
  )
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(200)
  email?: string;

  // Fecha de nacimiento opcional. Si se informa, debe ser fecha válida.
  @IsOptional()
  @ValidateIf(
    (o) =>
      o.birthDate !== undefined && o.birthDate !== null && o.birthDate !== '',
  )
  @IsDateString({}, { message: 'Fecha de nacimiento inválida' })
  birthDate?: string;

  // Dirección opcional. Si se informa, entre 3 y 500 caracteres.
  @IsOptional()
  @ValidateIf(
    (o) => o.address !== undefined && o.address !== null && o.address !== '',
  )
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  address?: string;

  @IsArray()
  @ArrayMaxSize(10, { message: 'Máximo 10 teléfonos por paciente' })
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones: PhoneDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'Máximo 50 contratistas por paciente' })
  @IsUUID('all', { each: true, message: 'IDs de contratistas inválidos' })
  contractorIds?: string[];

  /**
   * Seguros directos asignados al paciente. NO pueden solaparse con los
   * seguros derivados de `contractorIds` — service rechaza con detalle.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'Máximo 50 seguros directos por paciente' })
  @IsUUID('all', { each: true, message: 'IDs de seguros inválidos' })
  directInsuranceIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
