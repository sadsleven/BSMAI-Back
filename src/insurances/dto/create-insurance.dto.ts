import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PhoneDto } from './phone.dto';
import { ServicePriceDto } from '../../shared/dto/service-price.dto';
import { RIF_MESSAGE, RIF_PATTERN } from '../../shared/validators/ve-formats';

export class CreateInsuranceDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200)
  name: string;

  /** Nombre corto / abreviatura del seguro. Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El nombre corto no puede superar 100 caracteres' })
  shortName?: string;

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
  @MaxLength(500, { message: 'El dirección fiscal no puede superar 500 caracteres' })
  fiscalAddress?: string;

  @IsOptional()
  @ValidateIf((o) => o.rif !== undefined && o.rif !== null && o.rif !== '')
  @IsString()
  @Matches(RIF_PATTERN, { message: RIF_MESSAGE })
  rif?: string;

  @IsArray()
  @ArrayMaxSize(10, { message: 'Máximo 10 teléfonos por seguro' })
  @ValidateNested({ each: true })
  @Type(() => PhoneDto)
  phones: PhoneDto[];

  /**
   * Precios de cobro al seguro por Tipo de Servicio. Sólo los STs que cubre.
   * Replace-all en update.
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
}
