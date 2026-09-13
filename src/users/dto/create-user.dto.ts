import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'PasswordsMatch', async: false })
class PasswordsMatchConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const [relatedProperty] = args.constraints as string[];
    const related = (args.object as Record<string, unknown>)[relatedProperty];
    return value === related;
  }
  defaultMessage() {
    return 'Las contraseñas no coinciden';
  }
}

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName: string;

  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40, {
    message: 'El grado académico no puede superar 40 caracteres',
  })
  academicDegree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El cargo no puede superar 100 caracteres' })
  jobTitle?: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @IsString()
  @Validate(PasswordsMatchConstraint, ['password'])
  confirmPassword: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSuperAdmin?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  /**
   * Sucursales asignadas. Ignorado para Super Admins (acceso implícito a todas).
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  branchIds?: string[];
}
