import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxPayable } from './entities/tax-payable.entity';
import { TaxPayablePayment } from './entities/tax-payable-payment.entity';
import { TaxPaymentBatch } from './entities/tax-payment-batch.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';
import { AccountsPayable } from '../accounts-payable/entities/accounts-payable.entity';
import { AccountsPayableOrder } from '../accounts-payable/entities/accounts-payable-order.entity';
import { OrderInternalOrder } from '../orders/entities/order-internal-order.entity';
import { TaxesPayableService } from './taxes-payable.service';
import { TaxesPayableController } from './taxes-payable.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxPayable,
      TaxPayablePayment,
      TaxPaymentBatch,
      Branch,
      Bank,
      ExchangeRate,
      Doctor,
      CareCenter,
      AccountsPayable,
      AccountsPayableOrder,
      OrderInternalOrder,
    ]),
  ],
  providers: [TaxesPayableService],
  controllers: [TaxesPayableController],
  exports: [TypeOrmModule, TaxesPayableService],
})
export class TaxesPayableModule {}
