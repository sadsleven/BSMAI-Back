import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import {
  AccountsPayablePaymentDto,
  CreateAccountsPayableBatchDto,
  MutateAccountsPayableOrdersDto,
  QueryAccountsPayableDto,
  QueryPendingPayableDto,
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
  @Get('pending')
  listPending(
    @Query() query: QueryPendingPayableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listPending(query, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.LIST)
  @Get()
  listBatches(
    @Query() query: QueryAccountsPayableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listBatches(query, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.LIST)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneBatch(id, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.CREATE)
  @Post()
  createBatch(
    @Body() dto: CreateAccountsPayableBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createBatch(dto, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE)
  @Patch(':id/orders/add')
  addOrders(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MutateAccountsPayableOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addOrders(id, dto.internalOrderIds, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE)
  @Patch(':id/orders/remove')
  removeOrders(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MutateAccountsPayableOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeOrders(id, dto.internalOrderIds, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE)
  @Post(':id/payments')
  registerPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registerPayment(id, dto.payments, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE)
  @Patch(':id/payments/:paymentId')
  editPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: AccountsPayablePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.editPayment(id, paymentId, dto, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE)
  @Delete(':id/payments/:paymentId')
  deletePayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deletePayment(id, paymentId, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_PAYABLE.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(204)
  async deleteBatch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.service.deleteBatch(id, user);
  }
}
