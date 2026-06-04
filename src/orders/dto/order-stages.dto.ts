import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const PROVIDER_TYPES_FOR_BILLING = ['doctor', 'care_center'] as const;

/** Paso 2 — Atención del paciente. */
export class AttendOrderDto {
  @IsBoolean()
  attended: boolean;

  @IsOptional()
  @IsISO8601()
  attendedAt?: string;
}

/** Paso 3 — Informe médico y estudios. */
export class ReportOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  otherStudies?: string | null;
}

/** Pago en USD a un proveedor específico de la orden. */
export class BillingProviderDto {
  @IsIn(PROVIDER_TYPES_FOR_BILLING)
  providerType: 'doctor' | 'care_center';

  @ValidateIf((o) => o.providerType === 'doctor')
  @IsUUID('4')
  doctorId?: string;

  @ValidateIf((o) => o.providerType === 'care_center')
  @IsUUID('4')
  careCenterId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

/**
 * Paso 4 — Facturación y liquidación.
 *
 * Acepta una lista `providers[]` con un pago USD por proveedor distinto que
 * participa en la orden. `billingExchangeRateId` es la tasa **USD/Bs** vigente
 * al facturar — snapshot para convertir pagos BS/EUR a USD a posteriori.
 *
 * `doctorAmount` queda como total agregado USD (derivado en service).
 */
export class BillingOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Asigná al menos un pago a un proveedor' })
  @ValidateNested({ each: true })
  @Type(() => BillingProviderDto)
  providers: BillingProviderDto[];

  @IsUUID()
  billingExchangeRateId: string;
}

/**
 * Paso 1 — Autorización de monto por un usuario validador.
 *
 * El usuario que edita la orden (sin `orders.edit-amount`) solicita a otro
 * usuario que sí tenga el permiso que ingrese sus credenciales y el nuevo
 * monto + una observación. El validador queda registrado como autor del cambio.
 */
export class AuthorizeOrderAmountDto {
  @IsEmail({}, { message: 'Email del validador inválido' })
  validatorEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Contraseña del validador requerida' })
  validatorPassword: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  priceAmount: number;

  @IsString()
  @MinLength(3, { message: 'La observación debe tener al menos 3 caracteres' })
  @MaxLength(1000)
  observation: string;
}
