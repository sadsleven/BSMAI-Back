import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const PROVIDER_TYPES = ['doctor', 'care_center'] as const;

/**
 * Línea de servicio de un presupuesto. A diferencia de la orden, el proveedor
 * es opcional (al presupuestar normalmente no se sabe quién atiende) y el
 * precio unitario viaja desde el FE: es el snapshot cotizado, no el de
 * catálogo del momento de guardar.
 */
export class BudgetServiceTypeRowDto {
  @IsUUID()
  serviceTypeId: string;

  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El nombre del servicio es obligatorio' })
  @MaxLength(300, { message: 'Máximo 300 caracteres' })
  customName: string;

  @IsOptional()
  @IsInt({ message: 'La cantidad debe ser un entero' })
  @Min(1, { message: 'La cantidad debe ser ≥ 1' })
  @Max(100000, { message: 'Cantidad demasiado alta' })
  quantity?: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Precio inválido' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  unitPriceUsd: number;

  /** Precio de catálogo que el FE vio al armar la fila (traza del ajuste). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  catalogPriceUsd?: number;

  @IsOptional()
  @IsIn(PROVIDER_TYPES)
  providerType?: 'doctor' | 'care_center';

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  careCenterId?: string;
}
