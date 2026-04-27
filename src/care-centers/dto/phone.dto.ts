import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PHONE_MESSAGE, PHONE_PATTERN } from '../../shared/validators/ve-formats';

export class PhoneDto {
  @IsString()
  @Matches(PHONE_PATTERN, { message: PHONE_MESSAGE })
  number: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}
