import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Patient } from '../patients/entities/patient.entity';
import { Doctor } from '../doctors/entities/doctor.entity';
import { CareCenter } from '../care-centers/entities/care-center.entity';
import { Order } from '../orders/entities/order.entity';
import { Branch } from '../branches/entities/branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Doctor, CareCenter, Order, Branch])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
