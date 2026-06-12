import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateServiceTypeDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Precio Particular en USD. Opcional. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio Particular USD debe ser mayor a 0' })
  @Max(99999999.99)
  particularPriceUsd?: number;

  /** Permite asignar cantidad de este ST en una orden (ej. sesiones). */
  @IsOptional()
  @IsBoolean()
  allowsQuantity?: boolean;
}
