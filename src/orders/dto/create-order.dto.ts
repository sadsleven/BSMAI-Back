import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateOrderPaymentDto } from './order-payment.dto';

export const ORDER_TYPES = ['cash', 'credit', 'insurance', 'cashea'] as const;
export const PROVIDER_TYPES = ['doctor', 'care_center'] as const;
export const ORDER_CURRENCIES = ['USD', 'EUR'] as const;

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

  @IsIn(PROVIDER_TYPES)
  providerType: 'doctor' | 'care_center';

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  careCenterId?: string;

  @IsUUID()
  specialtyId: string;

  @IsUUID()
  serviceTypeId: string;

  @IsUUID()
  pathologyId: string;

  @IsISO8601()
  orderDate: string;

  @IsISO8601()
  appointmentDate: string;

  @IsIn(ORDER_CURRENCIES)
  priceCurrency: 'USD' | 'EUR';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceAmount: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPaymentDto)
  payments?: CreateOrderPaymentDto[];
}
