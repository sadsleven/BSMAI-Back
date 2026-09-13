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
import { RIF_MESSAGE, RIF_PATTERN } from '../../shared/validators/ve-formats';
import { PhoneDto } from './phone.dto';
import { PaymentMethodDto } from './payment-method.dto';
import { ServicePriceDto } from '../../shared/dto/service-price.dto';

export class CreateCareCenterDto {
  @IsString()
  @MinLength(2, { message: 'La razón social debe tener al menos 2 caracteres' })
  @MaxLength(200)
  businessName: string;

  /** Opcional; requerido sólo para habilitar el acceso (password). `''`→null. */
  @IsOptional()
  @ValidateIf(
    (o) => o.email !== undefined && o.email !== null && o.email !== '',
  )
  @IsEmail({}, { message: 'Email inválido' })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @ValidateIf((o) => o.rif !== undefined && o.rif !== null && o.rif !== '')
  @IsString()
  @Matches(RIF_PATTERN, { message: RIF_MESSAGE })
  rif?: string;

  /** Dirección del centro de atención. Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'La dirección del centro no puede superar 500 caracteres',
  })
  centerAddress?: string;

  @IsArray()
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

  /**
   * Precios que se pagan al centro por Tipo de Servicio. Sólo los STs que el
   * centro efectivamente realiza. Replace-all en update.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ServicePriceDto)
  servicePrices?: ServicePriceDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Contraseña de acceso (opcional). Si se define, habilita el acceso del centro
   * como usuario proveedor. En edición, cambia/establece la contraseña.
   */
  @IsOptional()
  @ValidateIf(
    (o) => o.password !== undefined && o.password !== null && o.password !== '',
  )
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(100)
  password?: string;
}
