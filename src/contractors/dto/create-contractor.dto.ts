import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContractorDto {
  /**
   * Nombre del contratista. Reglas relajadas: cualquier carácter, 1–200 chars.
   * Distinto a firstName/lastName de personas.
   */
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50, { message: 'Máximo 50 seguros por contratista' })
  @IsUUID('all', { each: true, message: 'IDs de seguros inválidos' })
  insuranceIds?: string[];
}
