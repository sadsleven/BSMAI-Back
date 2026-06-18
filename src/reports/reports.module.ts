import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../branches/entities/branch.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { TaxUnitsModule } from '../tax-units/tax-units.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, ExchangeRate]), TaxUnitsModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
