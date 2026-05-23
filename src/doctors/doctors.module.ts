import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { DoctorPhone } from './entities/doctor-phone.entity';
import { DoctorPaymentMethod } from './entities/doctor-payment-method.entity';
import { DoctorServicePrice } from './entities/doctor-service-price.entity';
import { Specialty } from '../specialties/entities/specialty.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { DoctorsService } from './doctors.service';
import { DoctorsController } from './doctors.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Doctor,
      DoctorPhone,
      DoctorPaymentMethod,
      DoctorServicePrice,
      Specialty,
      Bank,
      ServiceType,
    ]),
  ],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService, TypeOrmModule],
})
export class DoctorsModule {}
