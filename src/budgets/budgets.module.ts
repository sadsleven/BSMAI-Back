import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from './entities/budget.entity';
import { BudgetServiceType } from './entities/budget-service-type.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Pathology } from '../pathologies/entities/pathology.entity';
import { ServiceType } from '../service-types/entities/service-type.entity';
import { InsuranceServicePrice } from '../insurances/entities/insurance-service-price.entity';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Budget,
      BudgetServiceType,
      Branch,
      Patient,
      Pathology,
      ServiceType,
      InsuranceServicePrice,
    ]),
  ],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService, TypeOrmModule],
})
export class BudgetsModule {}
