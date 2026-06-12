import { Controller, Get, Query } from '@nestjs/common';
import { PaymentAccountReportsService } from './payment-account-reports.service';
import { QueryInflowsDto } from './dto/query-inflows.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('payment-accounts/reports')
export class PaymentAccountReportsController {
  constructor(private readonly service: PaymentAccountReportsService) {}

  @RequirePermissions(PERMISSIONS.REPORTS.PAYMENT_ACCOUNT_INFLOWS_LIST)
  @Get('inflows')
  inflows(@Query() query: QueryInflowsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.inflows(query, user);
  }
}
