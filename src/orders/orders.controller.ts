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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { CreateOrderPaymentDto, UpdateOrderPaymentDto } from './dto/order-payment.dto';
import {
  AttendOrderDto,
  AuthorizeOrderAmountDto,
  BillingOrderDto,
  ReportOrderDto,
} from './dto/order-stages.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @RequirePermissions(PERMISSIONS.ORDERS.LIST)
  @Get()
  findAll(@Query() query: QueryOrdersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(query, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.VIEW)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user, true);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.CREATE)
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.softDelete(id, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.hardDelete(id, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.RESTORE)
  @Patch(':id/restore')
  restore(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.restore(id, user);
  }

  // --- Paso 1: autorización de monto por validador ---

  @RequirePermissions(PERMISSIONS.ORDERS.UPDATE)
  @Patch(':id/authorize-amount')
  authorizeAmount(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AuthorizeOrderAmountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.authorizeAmount(id, dto, user);
  }

  // --- Pasos 2-4 del flujo (transiciones de estado) ---

  @RequirePermissions(PERMISSIONS.ORDERS.STAGE_ATTENTION)
  @Patch(':id/attend')
  attend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AttendOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.attend(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.STAGE_REPORT)
  @Patch(':id/report')
  report(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.report(id, dto, user);
  }

  @RequirePermissions(
    PERMISSIONS.ORDERS.STAGE_BILLING,
    PERMISSIONS.ORDERS.SET_PROVIDER_AMOUNT,
  )
  @Patch(':id/billing')
  billing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: BillingOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.billing(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.UPDATE)
  @Post(':id/payments')
  addPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateOrderPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addPayment(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.UPDATE)
  @Patch(':id/payments/:paymentId')
  updatePayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: UpdateOrderPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updatePayment(id, paymentId, dto, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/payments/:paymentId')
  removePayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.removePayment(id, paymentId, user);
  }
}
