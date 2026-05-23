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

  /** Precio Particular obligatorio en USD y EUR. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio Particular USD debe ser mayor a 0' })
  @Max(99999999.99)
  particularPriceUsd: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio Particular EUR debe ser mayor a 0' })
  @Max(99999999.99)
  particularPriceEur: number;
}
