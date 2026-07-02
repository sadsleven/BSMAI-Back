import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// El email es inmutable una vez creado el usuario: se omite del DTO de
// actualización, por lo que el ValidationPipe (whitelist) lo descarta.
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'confirmPassword', 'email'] as const),
) {}
