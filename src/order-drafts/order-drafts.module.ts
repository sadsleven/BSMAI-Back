import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderDraft } from './entities/order-draft.entity';
import { OrderDraftsService } from './order-drafts.service';
import { OrderDraftsController } from './order-drafts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrderDraft])],
  controllers: [OrderDraftsController],
  providers: [OrderDraftsService],
  exports: [OrderDraftsService, TypeOrmModule],
})
export class OrderDraftsModule {}
