import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
  RIF_MESSAGE,
  RIF_PATTERN,
} from '../../shared/validators/ve-formats';
import { PhoneDto } from './phone.dto';
import { PaymentMethodDto } from './payment-method.dto';

export class CreateCareCenterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(200)
  email: string;

  @IsString()
  @Matches(RIF_PATTERN, { message: RIF_MESSAGE })
  rif: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe ingresar al menos un teléfono' })
  @ArrayMaxSize(10, { message: 'Máximo 10 teléfonos por centro' })
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones: PhoneDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe asignar al menos una especialidad' })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  specialtyIds: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodDto)
  paymentMethods?: PaymentMethodDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
