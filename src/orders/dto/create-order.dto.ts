import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  Max,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CreateOrderPaymentDto } from './order-payment.dto';
import { OrderServiceTypeRowDto } from './order-service-type.dto';

export const ORDER_TYPES = ['cash', 'credit', 'insurance', 'cashea'] as const;
export const INSURANCE_SOURCES = ['direct', 'via_contractor'] as const;

export class CreateOrderDto {
  @IsUUID()
  branchId: string;

  @IsIn(ORDER_TYPES)
  type: 'cash' | 'credit' | 'insurance' | 'cashea';

  @IsUUID()
  holderId: string;

  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  contractorId?: string;

  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  /**
   * Origen del seguro. Requerido sólo cuando `type='insurance'`. Validado
   * además junto con `contractorId` en service.
   */
  @IsOptional()
  @IsIn(INSURANCE_SOURCES)
  insuranceSource?: 'direct' | 'via_contractor';

  /**
   * Clave de servicio externa del seguro (opcional, sólo type='insurance').
   * Texto libre ≤30 chars.
   */
  @IsOptional()
  @IsString()
  @MaxLength(30, {
    message: 'La clave de servicio no puede superar 30 caracteres',
  })
  serviceKey?: string;

  /**
   * Orden de reembolso. Sólo aplica a `type='credit'`; en otros tipos se ignora
   * (el service lo fuerza a false). Cuando true, la orden interna muestra "R".
   */
  @IsOptional()
  @IsBoolean()
  isReimbursement?: boolean;

  @IsUUID()
  specialtyId: string;

  /**
   * Número de orden elegido en el Paso 1. Cualquier entero ≥ 1 que esté LIBRE:
   * el formulario propone por defecto el mayor en uso + 1, y con varios
   * proveedores la orden ocupa el bloque consecutivo
   * `[customOrderNumber, customOrderNumber + proveedores - 1]` (un número por
   * orden interna del Paso 2). Requiere el permiso `orders.custom-number`; sin
   * este campo la numeración es automática.
   */
  @IsOptional()
  @IsInt({ message: 'El número de orden debe ser un entero' })
  @Min(1, { message: 'El número de orden debe ser mayor o igual a 1' })
  @Max(999999999, { message: 'El número de orden no puede superar 999999999' })
  customOrderNumber?: number;

  /**
   * Tipos de servicio con su proveedor por fila. Reemplaza el antiguo
   * `serviceTypeIds: string[]`. Cada fila debe respetar la regla XOR
   * doctor/care_center según `providerType`.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Asigna al menos un tipo de servicio' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderServiceTypeRowDto)
  serviceTypes: OrderServiceTypeRowDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  pathologyIds?: string[];

  @IsISO8601()
  orderDate: string;

  @IsISO8601()
  appointmentDate: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceAmount: number;

  /**
   * Motivo del ajuste de monto (descuento o recargo respecto de la suma de
   * precios de catálogo). Obligatorio cuando `priceAmount` difiere de esa suma;
   * el service lo exige y lo persiste junto a quién lo aplicó y cuándo.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  priceAdjustmentNote?: string;

  /**
   * Monto de la inicial Cashea, en USD. Requerido sólo cuando `type='cashea'`.
   * En el FE se ingresa como % del total (0 ≤ pct < 100) y el monto viaja ya
   * derivado. Debe ser ≥ 0 y < priceAmount (validado en service; 100% o más no
   * permitido). La cobra el comercio del titular en el Paso 1; el restante
   * (total − inicial) lo financia Cashea.
   */
  @ValidateIf((o: CreateOrderDto) => o.type === 'cashea')
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  casheaFirstInstallmentAmount?: number;

  /**
   * Tasa de la orden (USD/Bs) para seguros `isIndexed=true` (UI: "No indexado").
   * `useFixedRate` ya no se envía: el service lo deriva del flag del seguro.
   * Cuando el flag es true, esta tasa (día de la orden) es obligatoria; si no,
   * se ignora.
   */
  @IsOptional()
  @IsUUID()
  fixedExchangeRateId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPaymentDto)
  payments?: CreateOrderPaymentDto[];
}
