import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const BANK_CODE_PATTERN = /^\d{3,4}$/;

export class CreateBankDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(BANK_CODE_PATTERN, { message: 'El código debe tener 3 o 4 dígitos' })
  code: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
