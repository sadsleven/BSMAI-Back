import {
  IsIn,
  IsOptional,
  IsUUID,
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

  @IsOptional()
  @IsUUID('4', { each: true })
  __unused?: string[];
}
