import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insurance } from '../../insurances/entities/insurance.entity';
import { InsuranceServicePrice } from '../../insurances/entities/insurance-service-price.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { DoctorServicePrice } from '../../doctors/entities/doctor-service-price.entity';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { BaremosSeedService } from './baremos-seed.service';

/**
 * Módulo del seeder de baremos. Independiente de SeedModule: no corre en el
 * `npm run seed` general; se ejecuta aparte con `npm run seed:baremos`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceType,
      Insurance,
      InsuranceServicePrice,
      Doctor,
      DoctorServicePrice,
      Specialty,
    ]),
  ],
  providers: [BaremosSeedService],
})
export class BaremosSeedModule {}
