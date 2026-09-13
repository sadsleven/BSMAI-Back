import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insurance } from '../../insurances/entities/insurance.entity';
import { InsuranceServicePrice } from '../../insurances/entities/insurance-service-price.entity';
import { ServiceType } from '../../service-types/entities/service-type.entity';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { DoctorServicePrice } from '../../doctors/entities/doctor-service-price.entity';
import { CareCenter } from '../../care-centers/entities/care-center.entity';
import { CareCenterServicePrice } from '../../care-centers/entities/care-center-service-price.entity';
import { Specialty } from '../../specialties/entities/specialty.entity';
import { BaremosSeedService } from './baremos-seed.service';

/**
 * Módulo del seeder de baremos. Independiente de SeedModule: no corre en el
 * `npm run seed` general; se ejecuta aparte con `npm run seed:baremos` (o
 * `seed:baremos:insurances` / `:doctors` / `:care-centers`, con `-- "<nombre>"`
 * para uno solo y el token `actualizar-precios` —sin guiones: npm descarta
 * los `--`— para pisar los precios que cambiaron).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceType,
      Insurance,
      InsuranceServicePrice,
      Doctor,
      DoctorServicePrice,
      CareCenter,
      CareCenterServicePrice,
      Specialty,
    ]),
  ],
  providers: [BaremosSeedService],
})
export class BaremosSeedModule {}
