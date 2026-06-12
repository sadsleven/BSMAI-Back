import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsReceivable } from './entities/accounts-receivable.entity';
import { AccountsReceivablePayment } from './entities/accounts-receivable-payment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { AccountsReceivableService } from './accounts-receivable.service';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { PaymentAccountsModule } from '../payment-accounts/payment-accounts.module';

@Module({
  imports: [
    PaymentAccountsModule,
    TypeOrmModule.forFeature([
      AccountsReceivable,
      AccountsReceivablePayment,
      Branch,
      Bank,
      ExchangeRate,
    ]),
  ],
  providers: [AccountsReceivableService],
  controllers: [AccountsReceivableController],
})
export class AccountsReceivableModule {}
