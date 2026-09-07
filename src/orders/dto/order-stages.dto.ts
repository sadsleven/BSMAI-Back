import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const PROVIDER_TYPES_FOR_BILLING = ['doctor', 'care_center'] as const;

/** Tope del N° de factura (9 dígitos, igual que el N° de orden). */
export const MAX_INVOICE_NUMBER = 999_999_999;

/**
 * Cancelación de una orden (no borra: conserva el número y el contenido).
 * El motivo es obligatorio y queda en la orden + en el historial.
 */
export class CancelOrderDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la cancelación es obligatorio' })
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  @MaxLength(500)
  reason: string;
}

/**
 * Cambio del N° de orden después de creada (Paso 1). Renumera la orden completa:
 * el número pasa a ser el BASE y los proveedores toman el bloque consecutivo.
 */
export class ChangeOrderNumberDto {
  @IsInt({ message: 'El número de orden debe ser un entero' })
  @Min(1, { message: 'El número de orden debe ser mayor o igual a 1' })
  @Max(999999999, { message: 'El número de orden no puede superar 999999999' })
  number: number;
}

/** Paso 2 — Atención del paciente. */
export class AttendOrderDto {
  @IsBoolean()
  attended: boolean;

  @IsOptional()
  @IsISO8601()
  attendedAt?: string;
}

/** Observaciones del informe de un proveedor (doctor o centro) de la orden. */
export class ReportProviderDto {
  @IsIn(PROVIDER_TYPES_FOR_BILLING)
  providerType: 'doctor' | 'care_center';

  @ValidateIf((o) => o.providerType === 'doctor')
  @IsUUID('4')
  doctorId?: string;

  @ValidateIf((o) => o.providerType === 'care_center')
  @IsUUID('4')
  careCenterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observations?: string | null;
}

/** Paso 3 — Informe médico y estudios. */
export class ReportOrderDto {
  /** Nota general de la orden (nivel orden). Solo staff. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  otherStudies?: string | null;

  /** Observaciones segmentadas por proveedor (upsert por proveedor). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportProviderDto)
  providerReports?: ReportProviderDto[];
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
 * participa en la orden. `billingExchangeRateId` es la tasa **USD/Bs elegida
 * por el usuario** para emitir la factura: se imprime en el documento, convierte
 * los brutos de CxP / retenciones / reportes y, en órdenes de seguro no
 * indexado, fija el monto en Bs de la cuenta por cobrar.
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

  /**
   * ¿Se emite factura al finalizar? Sólo aplica a contado / crédito / cashea:
   * en las órdenes de seguro la factura es obligatoria y el service fuerza
   * `true`. Sin enviar, la orden se finaliza SIN factura (se puede emitir
   * después con `POST /orders/:id/invoices`).
   */
  @IsOptional()
  @IsBoolean()
  generateInvoice?: boolean;

  /**
   * N° de factura como entero (se imprime con ceros a la izquierda). Debe estar
   * libre: los números no se reutilizan, tampoco los de facturas anuladas. El
   * N° de control NO se envía — el service lo deriva (`número + 50`, con dos
   * ceros delante). Sólo requerido cuando la orden emite factura.
   */
  @ValidateIf((o) => o.generateInvoice !== false)
  @IsInt({ message: 'El número de factura debe ser un entero' })
  @Min(1, { message: 'El número de factura debe ser mayor o igual a 1' })
  @Max(MAX_INVOICE_NUMBER)
  invoiceNumber?: number;

  /**
   * Fecha a mostrar en la factura (date-only `YYYY-MM-DD`). Sin enviar, el
   * service usa la `orderDate` de la orden.
   */
  @IsOptional()
  @IsISO8601()
  invoiceDate?: string;

  /**
   * ¿La factura imprime la fila "Tasa de cambio BCV"? Sin enviar, vale la regla
   * derivada (`!useFixedRate`: sale salvo en seguro no indexado).
   */
  @IsOptional()
  @IsBoolean()
  showExchangeRate?: boolean;
}

/**
 * Emisión de una factura NUEVA para una orden ya finalizada cuya factura
 * vigente fue anulada. Mismos datos que el Paso 4 (número, fecha y tasa), sin
 * tocar la liquidación por proveedor.
 */
export class IssueOrderInvoiceDto {
  @IsInt({ message: 'El número de factura debe ser un entero' })
  @Min(1, { message: 'El número de factura debe ser mayor o igual a 1' })
  @Max(MAX_INVOICE_NUMBER)
  invoiceNumber: number;

  @IsOptional()
  @IsISO8601()
  invoiceDate?: string;

  /** Tasa USD/Bs de la nueva factura. Sin enviar, conserva la de la orden. */
  @IsOptional()
  @IsUUID()
  exchangeRateId?: string;

  /** ¿Imprime la fila "Tasa de cambio BCV"? Sin enviar, la regla derivada. */
  @IsOptional()
  @IsBoolean()
  showExchangeRate?: boolean;
}

/**
 * Anulación de una factura (NO de la orden): la orden sigue viva y puede emitir
 * otra factura. El número de la anulada queda quemado para siempre.
 */
export class CancelOrderInvoiceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la anulación es obligatorio' })
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  @MaxLength(500)
  reason: string;
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
