import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxPayable } from './entities/tax-payable.entity';
import { TaxPayablePayment } from './entities/tax-payable-payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { TaxesPayableService } from './taxes-payable.service';
import { TaxesPayableController } from './taxes-payable.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxPayable,
      TaxPayablePayment,
      Order,
      Branch,
      Bank,
      ExchangeRate,
    ]),
  ],
  providers: [TaxesPayableService],
  controllers: [TaxesPayableController],
})
export class TaxesPayableModule {}
