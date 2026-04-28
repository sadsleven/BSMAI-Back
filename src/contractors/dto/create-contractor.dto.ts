import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
