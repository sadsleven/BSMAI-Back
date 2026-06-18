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
import { AccountsReceivableService } from './accounts-receivable.service';
import {
  AccountsReceivablePaymentDto,
  CreateAccountsReceivableBatchDto,
  MutateAccountsReceivableOrdersDto,
  QueryAccountsReceivableDto,
  QueryPendingReceivableDto,
  RegisterCollectionDto,
} from './dto/register-collection.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('accounts-receivable')
export class AccountsReceivableController {
  constructor(private readonly service: AccountsReceivableService) {}

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.LIST)
  @Get('pending')
  listPending(
    @Query() query: QueryPendingReceivableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listPending(query, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.LIST)
  @Get()
  listBatches(
    @Query() query: QueryAccountsReceivableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listBatches(query, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.LIST)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneBatch(id, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.CREATE)
  @Post()
  createBatch(
    @Body() dto: CreateAccountsReceivableBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createBatch(dto, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.UPDATE)
  @Patch(':id/orders/add')
  addOrders(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MutateAccountsReceivableOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addOrders(id, dto.orderIds, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.UPDATE)
  @Patch(':id/orders/remove')
  removeOrders(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MutateAccountsReceivableOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeOrders(id, dto.orderIds, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.UPDATE)
  @Post(':id/payments')
  registerCollection(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RegisterCollectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registerCollection(id, dto.payments, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.UPDATE)
  @Patch(':id/payments/:paymentId')
  editPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: AccountsReceivablePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.editPayment(id, paymentId, dto, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.UPDATE)
  @Delete(':id/payments/:paymentId')
  deletePayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deletePayment(id, paymentId, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(204)
  async deleteBatch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.service.deleteBatch(id, user);
  }
}
