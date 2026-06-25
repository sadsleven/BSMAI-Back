import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const PROVIDER_TYPES = ['doctor', 'care_center'] as const;

/** Fila ST + proveedor dentro de una orden. */
export class OrderServiceTypeRowDto {
  @IsUUID('4')
  serviceTypeId: string;

  @IsIn(PROVIDER_TYPES)
  providerType: 'doctor' | 'care_center';

  @ValidateIf((o) => o.providerType === 'doctor')
  @IsUUID('4')
  doctorId?: string;

  @ValidateIf((o) => o.providerType === 'care_center')
  @IsUUID('4')
  careCenterId?: string;

  /**
   * Cantidad del ST (ej. sesiones). Todo ST admite cantidad. Default 1 si no
   * se envía; mínimo 1.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity?: number;

  /**
   * Nombre personalizado para este ST en la orden (override de serviceType.name).
   * Aparece en Paso 1/2/4 y en el detalle. Vacío = usar el nombre original.
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  customName?: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  __unused?: string[];
}
