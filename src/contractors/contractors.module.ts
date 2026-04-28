import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contractor } from './entities/contractor.entity';
import { ContractorsService } from './contractors.service';
import { ContractorsController } from './contractors.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Contractor])],
  controllers: [ContractorsController],
  providers: [ContractorsService],
  exports: [ContractorsService, TypeOrmModule],
})
export class ContractorsModule {}
