import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
   * Nombre de este ST para la orden. OBLIGATORIO. Se elige/reutiliza en el
   * Paso 1 (selector con nombres previos del ST + alta de uno nuevo) y se muestra
   * en Paso 2 (órdenes internas: Excel/PDF), Paso 4 (factura) y el detalle.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nombre para la orden es obligatorio' })
  @MaxLength(300)
  customName: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  __unused?: string[];
}
