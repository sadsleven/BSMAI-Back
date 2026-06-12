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
import { PaymentMethodDto } from './payment-method.dto';
import { ServicePriceDto } from '../../shared/dto/service-price.dto';

const NAME_PATTERN = /^[A-Za-zÀ-ÿñÑ\s]+$/;

export class CreateDoctorDto {
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

  @IsOptional()
  @IsBoolean()
  isLegalEntity?: boolean;

  /** Sólo aceptado/obligatorio cuando `isLegalEntity === true`. */
  @ValidateIf((o) => o.isLegalEntity === true)
  @IsString()
  @Matches(RIF_PATTERN, { message: RIF_MESSAGE })
  rif?: string;

  @IsArray()
  @ArrayMaxSize(10, { message: 'Máximo 10 teléfonos por doctor' })
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

  /**
   * Precios que se pagan al doctor por Tipo de Servicio realizado. Sólo los STs
   * que el doctor efectivamente realiza. Replace-all en update.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ServicePriceDto)
  servicePrices?: ServicePriceDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Contraseña de acceso (opcional). Si se define, habilita el acceso del
   * doctor como usuario proveedor. En edición, cambia/establece la contraseña.
   */
  @IsOptional()
  @ValidateIf((o) => o.password !== undefined && o.password !== null && o.password !== '')
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100)
  password?: string;
}
