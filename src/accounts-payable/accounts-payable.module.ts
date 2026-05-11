import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsPayable } from './entities/accounts-payable.entity';
import { AccountsPayablePayment } from './entities/accounts-payable-payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { AccountsPayableService } from './accounts-payable.service';
import { AccountsPayableController } from './accounts-payable.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountsPayable,
      AccountsPayablePayment,
      Order,
      Branch,
      Bank,
      ExchangeRate,
      Doctor,
    ]),
  ],
  providers: [AccountsPayableService],
  controllers: [AccountsPayableController],
})
export class AccountsPayableModule {}
