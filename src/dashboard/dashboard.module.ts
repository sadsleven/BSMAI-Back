import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order } from '../orders/entities/order.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Patient, Branch, ExchangeRate])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
