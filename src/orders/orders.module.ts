import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OrderPayment } from './entities/order-payment.entity';
import { OrderServicePricing } from './entities/order-service-pricing.entity';
import { OrderServiceType } from './entities/order-service-type.entity';
import { OrderProviderReport } from './entities/order-provider-report.entity';
import { OrderInternalOrder } from './entities/order-internal-order.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Bank } from '../banks/entities/bank.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { Pathology } from '../pathologies/entities/pathology.entity';
import { Insurance } from '../insurances/entities/insurance.entity';
import { InsuranceServicePrice } from '../insurances/entities/insurance-service-price.entity';
import { DoctorServicePrice } from '../doctors/entities/doctor-service-price.entity';
import { CareCenterServicePrice } from '../care-centers/entities/care-center-service-price.entity';
import { AuthModule } from '../auth/auth.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { PaymentAccountsModule } from '../payment-accounts/payment-accounts.module';
import { ProviderAccountsModule } from '../provider-accounts/provider-accounts.module';

@Module({
  imports: [
    AuthModule,
    AppConfigModule,
    PaymentAccountsModule,
    ProviderAccountsModule,
    TypeOrmModule.forFeature([
      Order,
      OrderPayment,
      OrderServicePricing,
      OrderServiceType,
      OrderProviderReport,
      OrderInternalOrder,
      Patient,
      Doctor,
      CareCenter,
      Branch,
      Bank,
      ExchangeRate,
      ServiceType,
      Pathology,
      Insurance,
      InsuranceServicePrice,
      DoctorServicePrice,
      CareCenterServicePrice,
    ]),
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
