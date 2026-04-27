import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pathology } from './entities/pathology.entity';
import { PathologiesService } from './pathologies.service';
import { PathologiesController } from './pathologies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pathology])],
  controllers: [PathologiesController],
  providers: [PathologiesService],
  exports: [PathologiesService, TypeOrmModule],
})
export class PathologiesModule {}
