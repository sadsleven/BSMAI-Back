import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PhoneDto } from './phone.dto';

export class CreateInsuranceDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'El domicilio fiscal no puede superar 500 caracteres' })
  fiscalAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'El número de póliza no puede superar 64 caracteres' })
  policyNumber?: string;

  @IsArray()
  @ArrayMaxSize(10, { message: 'Máximo 10 teléfonos por seguro' })
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones: PhoneDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
