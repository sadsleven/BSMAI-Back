import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Order } from '../orders/entities/order.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { AccountsPayable } from '../accounts-payable/entities/accounts-payable.entity';
import { AccountsReceivable } from '../accounts-receivable/entities/accounts-receivable.entity';
import { AccountsPayablePayment } from '../accounts-payable/entities/accounts-payable-payment.entity';
import { AccountsReceivablePayment } from '../accounts-receivable/entities/accounts-receivable-payment.entity';
import { TaxPayable } from '../taxes-payable/entities/tax-payable.entity';
import { TaxPayablePayment } from '../taxes-payable/entities/tax-payable-payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Patient,
      Branch,
      ExchangeRate,
      AccountsPayable,
      AccountsReceivable,
      AccountsPayablePayment,
      AccountsReceivablePayment,
      TaxPayable,
      TaxPayablePayment,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
