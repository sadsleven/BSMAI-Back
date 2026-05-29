import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditsReceivable } from './entities/credits-receivable.entity';
import { CreditsReceivablePayment } from './entities/credits-receivable-payment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { CreditsReceivableService } from './credits-receivable.service';
import { CreditsReceivableController } from './credits-receivable.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditsReceivable,
      CreditsReceivablePayment,
      Branch,
      Bank,
      ExchangeRate,
    ]),
  ],
  providers: [CreditsReceivableService],
  controllers: [CreditsReceivableController],
})
export class CreditsReceivableModule {}
