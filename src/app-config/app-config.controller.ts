import { Body, Controller, Get, Put } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { UpdateCasheaCommissionDto } from './dto/update-cashea-commission.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly service: AppConfigService) {}

  @RequirePermissions(PERMISSIONS.APP_CONFIG.VIEW)
  @Get('cashea')
  async getCashea(): Promise<{ commissionRate: number }> {
    const rate = await this.service.getCasheaCommissionRate();
    return { commissionRate: rate };
  }

  @RequirePermissions(PERMISSIONS.APP_CONFIG.UPDATE)
  @Put('cashea')
  async updateCashea(
    @Body() dto: UpdateCasheaCommissionDto,
  ): Promise<{ commissionRate: number }> {
    return this.service.setCasheaCommissionRate(dto.commissionRate);
  }
}
