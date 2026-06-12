import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PaymentAccountsService } from './payment-accounts.service';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { UpdatePaymentAccountDto } from './dto/update-payment-account.dto';
import {
  AssignablePaymentAccountsQueryDto,
  QueryPaymentAccountsDto,
} from './dto/query-payment-accounts.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('payment-accounts')
export class PaymentAccountsController {
  constructor(private readonly service: PaymentAccountsService) {}

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.LIST)
  @Get()
  findAll(@Query() query: QueryPaymentAccountsDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.LIST)
  @Get('assignable')
  findAssignable(@Query() query: AssignablePaymentAccountsQueryDto) {
    return this.service.findAssignable(query);
  }

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.CREATE)
  @Post()
  create(@Body() dto: CreatePaymentAccountDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePaymentAccountDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.PAYMENT_ACCOUNTS.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
