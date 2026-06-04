import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @RequirePermissions(PERMISSIONS.PATIENTS.LIST)
  @Get('patients-active-count')
  patientsActiveCount() {
    return this.service.patientsActiveCount();
  }

  @RequirePermissions(PERMISSIONS.ORDERS.LIST)
  @Get('orders-today-count')
  ordersTodayCount(@CurrentUser() user: AuthenticatedUser) {
    return this.service.ordersTodayCount(user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.LIST)
  @Get('orders-pending-count')
  ordersPendingCount(@CurrentUser() user: AuthenticatedUser) {
    return this.service.ordersPendingCount(user);
  }

  @RequirePermissions(
    PERMISSIONS.ACCOUNTS_PAYABLE.LIST,
    PERMISSIONS.ACCOUNTS_RECEIVABLE.LIST,
  )
  @Get('billed-month-usd')
  billedMonthUsd(@CurrentUser() user: AuthenticatedUser) {
    return this.service.billedMonthUsd(user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.LIST)
  @Get('collected-month-usd')
  collectedMonthUsd(@CurrentUser() user: AuthenticatedUser) {
    return this.service.collectedMonthUsd(user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.LIST)
  @Get('receivable-total-usd')
  receivableTotalUsd(@CurrentUser() user: AuthenticatedUser) {
    return this.service.receivableTotalUsd(user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.LIST)
  @Get('payable-total-usd')
  payableTotalUsd(@CurrentUser() user: AuthenticatedUser) {
    return this.service.payableTotalUsd(user);
  }
}
