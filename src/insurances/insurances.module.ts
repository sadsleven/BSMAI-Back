import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insurance } from './entities/insurance.entity';
import { InsurancePhone } from './entities/insurance-phone.entity';
import { InsuranceServicePrice } from './entities/insurance-service-price.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { InsurancesService } from './insurances.service';
import { InsurancesController } from './insurances.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Insurance,
      InsurancePhone,
      InsuranceServicePrice,
      ServiceType,
    ]),
  ],
  controllers: [InsurancesController],
  providers: [InsurancesService],
  exports: [InsurancesService, TypeOrmModule],
})
export class InsurancesModule {}
