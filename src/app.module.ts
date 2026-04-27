import { Module } from '@nestjs/common';
import { ConnectionBD } from './config/ormconfig.config';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
//Controllers
import { AppController } from './app.controller';
//Services
import { AppService } from './app.service';
//Modules
import { SeedModule } from './seed/seed.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { BanksModule } from './banks/banks.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { CareCentersModule } from './care-centers/care-centers.module';
import { InsurancesModule } from './insurances/insurances.module';
import { PathologiesModule } from './pathologies/pathologies.module';
import { ServiceTypesModule } from './service-types/service-types.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ConnectionBD,
    SeedModule,
    WebsocketModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    SpecialtiesModule,
    BanksModule,
    PatientsModule,
    DoctorsModule,
    CareCentersModule,
    InsurancesModule,
    PathologiesModule,
    ServiceTypesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
