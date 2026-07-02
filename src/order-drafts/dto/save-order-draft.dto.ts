import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Guardar/actualizar un borrador parcial del Paso 1. El `payload` es freeform
 * (los valores del formulario, posiblemente incompletos) y NO se valida acá:
 * la validación completa ocurre al crear la orden real.
 */
export class SaveOrderDraftDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsObject()
  payload: Record<string, unknown>;
}
