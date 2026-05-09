import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceType } from './entities/service-type.entity';
import { ServiceTypePrice } from './entities/service-type-price.entity';
import { Insurance } from '../insurances/entities/insurance.entity';
import { ServiceTypesService } from './service-types.service';
import { ServiceTypesController } from './service-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceType, ServiceTypePrice, Insurance])],
  controllers: [ServiceTypesController],
  providers: [ServiceTypesService],
  exports: [ServiceTypesService, TypeOrmModule],
})
export class ServiceTypesModule {}
