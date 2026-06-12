import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxUnit } from './entities/tax-unit.entity';
import { TaxUnitsService } from './tax-units.service';
import { TaxUnitsController } from './tax-units.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TaxUnit])],
  controllers: [TaxUnitsController],
  providers: [TaxUnitsService],
  exports: [TaxUnitsService, TypeOrmModule],
})
export class TaxUnitsModule {}
