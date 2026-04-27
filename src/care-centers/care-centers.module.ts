import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CareCenter } from './entities/care-center.entity';
import { CareCenterPhone } from './entities/care-center-phone.entity';
import { CareCenterPaymentMethod } from './entities/care-center-payment-method.entity';
import { Specialty } from '../specialties/entities/specialty.entity';
import { Bank } from '../banks/entities/bank.entity';
import { CareCentersService } from './care-centers.service';
import { CareCentersController } from './care-centers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CareCenter,
      CareCenterPhone,
      CareCenterPaymentMethod,
      Specialty,
      Bank,
    ]),
  ],
  controllers: [CareCentersController],
  providers: [CareCentersService],
  exports: [CareCentersService, TypeOrmModule],
})
export class CareCentersModule {}
