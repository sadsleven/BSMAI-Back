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
import { TaxesPayableService } from './taxes-payable.service';
import {
  CreateTaxBatchDto,
  MutateTaxBatchObligationsDto,
  QueryPendingTaxDto,
  QueryTaxesPayableDto,
  RegisterTaxPaymentDto,
  TaxPayablePaymentDto,
} from './dto/register-tax-payment.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('taxes-payable')
export class TaxesPayableController {
  constructor(private readonly service: TaxesPayableService) {}

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.LIST)
  @Get('pending')
  listPending(@Query() query: QueryPendingTaxDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listPending(query, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.LIST)
  @Get()
  listBatches(@Query() query: QueryTaxesPayableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listBatches(query, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.LIST)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneBatch(id, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.CREATE)
  @Post()
  createBatch(@Body() dto: CreateTaxBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createBatch(dto, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.UPDATE)
  @Patch(':id/obligations/add')
  addObligations(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MutateTaxBatchObligationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addObligations(id, dto.taxPayableIds, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.UPDATE)
  @Patch(':id/obligations/remove')
  removeObligations(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MutateTaxBatchObligationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removeObligations(id, dto.taxPayableIds, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.UPDATE)
  @Post(':id/payments')
  registerPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RegisterTaxPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registerPayment(id, dto.payments, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.UPDATE)
  @Patch(':id/payments/:paymentId')
  editPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: TaxPayablePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.editPayment(id, paymentId, dto, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.UPDATE)
  @Delete(':id/payments/:paymentId')
  deletePayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deletePayment(id, paymentId, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(204)
  async deleteBatch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.service.deleteBatch(id, user);
  }
}
