import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PHONE_PATTERN } from '../../shared/validators/ve-formats';

export type PaymentMethodType = 'mobile_payment' | 'bank_transfer' | 'other';

const ACCOUNT_NUMBER_PATTERN = /^\d{20}$/;
const BANK_CODE_PATTERN = /^\d{3,4}$/;

/**
 * DTO único para los 3 tipos de método de pago. Cada campo se valida sólo
 * cuando aplica al `type` correspondiente. Service también valida que
 * `bankCode` exista en la tabla `banks`.
 */
export class PaymentMethodDto {
  @IsIn(['mobile_payment', 'bank_transfer', 'other'])
  type: PaymentMethodType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ---- mobile_payment ----
  @ValidateIf((o) => o.type === 'mobile_payment')
  @IsString()
  @Matches(BANK_CODE_PATTERN, { message: 'Código de banco inválido' })
  bankCode?: string;

  @ValidateIf((o) => o.type === 'mobile_payment')
  @IsString()
  @Matches(PHONE_PATTERN, {
    message: 'El teléfono debe tener exactamente 11 dígitos',
  })
  phoneNumber?: string;

  // ---- mobile_payment + bank_transfer ----
  @ValidateIf((o) => o.type === 'mobile_payment' || o.type === 'bank_transfer')
  @IsString()
  @MaxLength(24)
  idDocument?: string;

  // ---- bank_transfer ----
  @ValidateIf((o) => o.type === 'bank_transfer')
  @IsString()
  @Matches(ACCOUNT_NUMBER_PATTERN, {
    message: 'El número de cuenta debe tener exactamente 20 dígitos',
  })
  accountNumber?: string;

  @ValidateIf((o) => o.type === 'bank_transfer')
  @IsString()
  @MaxLength(200)
  accountHolderName?: string;

  // ---- other ----
  @ValidateIf((o) => o.type === 'other')
  @IsString()
  @MaxLength(500)
  description?: string;
}
