import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsReceivable } from './entities/accounts-receivable.entity';
import { AccountsReceivablePayment } from './entities/accounts-receivable-payment.entity';
import { AccountsReceivableOrder } from './entities/accounts-receivable-order.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { Insurance } from '../insurances/entities/insurance.entity';
import { Patient } from '../patients/entities/patient.entity';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { PaymentAccountsModule } from '../payment-accounts/payment-accounts.module';

@Module({
  imports: [
    PaymentAccountsModule,
    TypeOrmModule.forFeature([
      AccountsReceivable,
      AccountsReceivablePayment,
      AccountsReceivableOrder,
      Order,
      Branch,
      Bank,
      ExchangeRate,
      Insurance,
      Patient,
    ]),
  ],
  providers: [AccountsReceivableService],
  controllers: [AccountsReceivableController],
})
export class AccountsReceivableModule {}
