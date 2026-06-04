import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from './entities/app-config.entity';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppConfig])],
  controllers: [AppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService, TypeOrmModule],
})
export class AppConfigModule {}
