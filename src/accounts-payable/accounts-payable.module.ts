import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsPayable } from './entities/accounts-payable.entity';
import { AccountsPayablePayment } from './entities/accounts-payable-payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { TaxPayable } from '../taxes-payable/entities/tax-payable.entity';
import { TaxPayablePayment } from '../taxes-payable/entities/tax-payable-payment.entity';
import { TaxUnitsModule } from '../tax-units/tax-units.module';
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
      TaxPayable,
      TaxPayablePayment,
    ]),
    TaxUnitsModule,
  ],
  providers: [AccountsPayableService],
  controllers: [AccountsPayableController],
})
export class AccountsPayableModule {}
