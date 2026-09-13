import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PHONE_PATTERN } from '../../shared/validators/ve-formats';

export type PaymentAccountType =
  | 'mobile_payment'
  | 'bank_transfer'
  | 'bank_transfer_usd'
  | 'card'
  | 'other';

const ACCOUNT_NUMBER_PATTERN = /^\d{20}$/;
const BANK_CODE_PATTERN = /^\d{3,4}$/;

/**
 * DTO único para los 4 tipos de cuenta de pago. Cada campo se valida sólo
 * cuando aplica al `type` correspondiente. Service valida que `bankCode`
 * exista en la tabla `banks`.
 *
 * `card` (Punto / POS de tarjeta): banco emisor + titular. El número de
 * referencia se captura por transacción, no en la cuenta.
 */
export class CreatePaymentAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsIn([
    'mobile_payment',
    'bank_transfer',
    'bank_transfer_usd',
    'card',
    'other',
  ])
  type: PaymentAccountType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ---- mobile_payment + bank_transfer + bank_transfer_usd + card ----
  @ValidateIf(
    (o) =>
      o.type === 'mobile_payment' ||
      o.type === 'bank_transfer' ||
      o.type === 'bank_transfer_usd' ||
      o.type === 'card',
  )
  @IsString()
  @Matches(BANK_CODE_PATTERN, { message: 'Código de banco inválido' })
  bankCode?: string;

  @ValidateIf(
    (o) =>
      o.type === 'mobile_payment' ||
      o.type === 'bank_transfer' ||
      o.type === 'bank_transfer_usd',
  )
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  idDocument?: string;

  @ValidateIf(
    (o) =>
      o.type === 'mobile_payment' ||
      o.type === 'bank_transfer' ||
      o.type === 'bank_transfer_usd' ||
      o.type === 'card',
  )
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  accountHolderName?: string;

  // ---- mobile_payment ----
  @ValidateIf((o) => o.type === 'mobile_payment')
  @IsString()
  @Matches(PHONE_PATTERN, {
    message: 'El teléfono debe tener exactamente 11 dígitos',
  })
  phoneNumber?: string;

  // ---- bank_transfer + bank_transfer_usd ----
  @ValidateIf(
    (o) => o.type === 'bank_transfer' || o.type === 'bank_transfer_usd',
  )
  @IsString()
  @Matches(ACCOUNT_NUMBER_PATTERN, {
    message: 'El número de cuenta debe tener exactamente 20 dígitos',
  })
  accountNumber?: string;

  // ---- other ----
  @ValidateIf((o) => o.type === 'other')
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description?: string;
}
