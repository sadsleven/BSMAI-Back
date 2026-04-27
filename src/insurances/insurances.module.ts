import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Insurance } from './entities/insurance.entity';
import { InsurancePhone } from './entities/insurance-phone.entity';
import { InsurancesService } from './insurances.service';
import { InsurancesController } from './insurances.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Insurance, InsurancePhone])],
  controllers: [InsurancesController],
  providers: [InsurancesService],
  exports: [InsurancesService, TypeOrmModule],
})
export class InsurancesModule {}
