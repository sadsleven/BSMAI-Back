import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
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
  @MaxLength(30, { message: 'La clave de servicio no puede superar 30 caracteres' })
  serviceKey?: string;

  @IsUUID()
  specialtyId: string;

  /**
   * Tipos de servicio con su proveedor por fila. Reemplaza el antiguo
   * `serviceTypeIds: string[]`. Cada fila debe respetar la regla XOR
   * doctor/care_center según `providerType`.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'Asigná al menos un tipo de servicio' })
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
   * Sólo válido para `type='insurance'`. Cuando true, la cuenta por cobrar del
   * seguro se fija en Bs usando `fixedExchangeRateId`. Requiere también que
   * `fixedExchangeRateId` esté presente y apunte a una tasa USD/Bs.
   */
  @IsOptional()
  @IsBoolean()
  useFixedRate?: boolean;

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
