import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CEDULA_MESSAGE,
  CEDULA_PATTERN,
} from '../../shared/validators/ve-formats';
import { PhoneDto } from './phone.dto';

const NAME_PATTERN = /^[A-Za-zÀ-ÿñÑ\s]+$/;

export class CreatePatientDto {
  @IsString()
  @Matches(CEDULA_PATTERN, { message: CEDULA_MESSAGE })
  cedula: string;

  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(200)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @Matches(NAME_PATTERN, { message: 'El nombre solo permite letras y espacios' })
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @Matches(NAME_PATTERN, { message: 'El apellido solo permite letras y espacios' })
  lastName: string;

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
  @IsBoolean()
  isActive?: boolean;
}
