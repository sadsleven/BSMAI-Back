import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40, { message: 'El grado académico no puede superar 40 caracteres' })
  academicDegree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El cargo no puede superar 100 caracteres' })
  jobTitle?: string;
}
