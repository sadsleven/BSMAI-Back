import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { BcvScraperService } from './bcv/bcv-scraper.service';
import { BcvRatesSyncService } from './bcv/bcv-rates-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeRate])],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService, BcvScraperService, BcvRatesSyncService],
  exports: [ExchangeRatesService, BcvRatesSyncService, TypeOrmModule],
})
export class ExchangeRatesModule {}
