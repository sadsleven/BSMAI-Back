import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAccount } from './entities/payment-account.entity';
import { Bank } from '../banks/entities/bank.entity';
import { Branch } from '../branches/entities/branch.entity';
import { OrderPayment } from '../orders/entities/order-payment.entity';
import { AccountsReceivablePayment } from '../accounts-receivable/entities/accounts-receivable-payment.entity';
import { PaymentAccountsService } from './payment-accounts.service';
import { PaymentAccountsController } from './payment-accounts.controller';
import { PaymentAccountReportsService } from './payment-account-reports.service';
import { PaymentAccountReportsController } from './payment-account-reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentAccount,
      Bank,
      Branch,
      OrderPayment,
      AccountsReceivablePayment,
    ]),
  ],
  controllers: [PaymentAccountsController, PaymentAccountReportsController],
  providers: [PaymentAccountsService, PaymentAccountReportsService],
  exports: [PaymentAccountsService, TypeOrmModule],
})
export class PaymentAccountsModule {}
