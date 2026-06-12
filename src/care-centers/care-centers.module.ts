import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareCenter } from './entities/care-center.entity';
import { CareCenterPhone } from './entities/care-center-phone.entity';
import { CareCenterPaymentMethod } from './entities/care-center-payment-method.entity';
import { CareCenterServicePrice } from './entities/care-center-service-price.entity';
import { Specialty } from '../specialties/entities/specialty.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { CareCentersService } from './care-centers.service';
import { CareCentersController } from './care-centers.controller';
import { ProviderAccountsModule } from '../provider-accounts/provider-accounts.module';

@Module({
  imports: [
    ProviderAccountsModule,
    TypeOrmModule.forFeature([
      CareCenter,
      CareCenterPhone,
      CareCenterPaymentMethod,
      CareCenterServicePrice,
      Specialty,
      Bank,
      ServiceType,
    ]),
  ],
  controllers: [CareCentersController],
  providers: [CareCentersService],
  exports: [CareCentersService, TypeOrmModule],
})
export class CareCentersModule {}
