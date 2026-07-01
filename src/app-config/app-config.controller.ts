import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  AppConfigService,
  CasheaCommissionConfig,
} from './app-config.service';
import { UpdateCasheaCommissionDto } from './dto/update-cashea-commission.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly service: AppConfigService) {}

  @RequirePermissions(PERMISSIONS.APP_CONFIG.VIEW)
  @Get('cashea')
  async getCashea(): Promise<CasheaCommissionConfig> {
    return this.service.getCasheaCommissionConfig();
  }

  @RequirePermissions(PERMISSIONS.APP_CONFIG.UPDATE)
  @Put('cashea')
  async updateCashea(
    @Body() dto: UpdateCasheaCommissionDto,
  ): Promise<CasheaCommissionConfig> {
    return this.service.setCasheaCommissionConfig({
      commissionRate: dto.commissionRate,
      financingRate: dto.financingRate,
    });
  }
}
