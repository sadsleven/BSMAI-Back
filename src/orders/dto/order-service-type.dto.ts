import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
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
   * Cantidad del ST (ej. sesiones). Sólo aplica si el ST tiene `allowsQuantity`;
   * para el resto el service la fuerza a 1. Default 1 si no se envía.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  quantity?: number;

  @IsOptional()
  @IsUUID('4', { each: true })
  __unused?: string[];
}
