import {
  IsOptional,
  IsString,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'NewPasswordsMatch', async: false })
class NewPasswordsMatchConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const [relatedProperty] = args.constraints as string[];
    const related = (args.object as Record<string, unknown>)[relatedProperty];
    return value === related;
  }
  defaultMessage() {
    return 'Las contraseñas nuevas no coinciden';
  }
}

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  newPassword: string;

  @IsString()
  @Validate(NewPasswordsMatchConstraint, ['newPassword'])
  confirmNewPassword: string;
}
