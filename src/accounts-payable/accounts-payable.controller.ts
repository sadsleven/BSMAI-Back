import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import {
  QueryAccountsPayableDto,
  RegisterPaymentDto,
} from './dto/register-payment.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('accounts-payable')
export class AccountsPayableController {
  constructor(private readonly service: AccountsPayableService) {}

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.LIST)
  @Get()
  findAll(@Query() query: QueryAccountsPayableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(query, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.VIEW)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE)
  @Post('register-payment')
  registerPayment(@Body() dto: RegisterPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.registerPayment(dto, user);
  }
}
