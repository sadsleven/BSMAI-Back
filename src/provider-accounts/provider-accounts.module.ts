import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';
import { ProviderAccountsService } from './provider-accounts.service';

/**
 * Módulo compartido (sin controller). Expone `ProviderAccountsService` para que
 * Doctors/CareCenters lo usen para aprovisionar cuentas, y Orders/Files/Auth
 * para resolver el vínculo `user → proveedor`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Doctor, CareCenter])],
  providers: [ProviderAccountsService],
  exports: [ProviderAccountsService],
})
export class ProviderAccountsModule {}
