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
import { QueryOrderNumberDto } from './dto/query-order-number.dto';
import { CreateOrderPaymentDto, UpdateOrderPaymentDto } from './dto/order-payment.dto';
import {
  AttendOrderDto,
  AuthorizeOrderAmountDto,
  BillingOrderDto,
  CancelOrderDto,
  ChangeOrderNumberDto,
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

  /** Nombres personalizados ya usados para un ST (autocompletar Paso 1). */
  @RequirePermissions(PERMISSIONS.ORDERS.LIST)
  @Get('service-types/:serviceTypeId/custom-names')
  customNames(
    @Param('serviceTypeId', new ParseUUIDPipe()) serviceTypeId: string,
  ) {
    return this.service.customNameSuggestions(serviceTypeId);
  }

  /**
   * Piso de la numeración automática (`ORDER_NUMBER_START`). Los números
   * manuales de órdenes históricas deben ser menores a este valor. Sólo JWT
   * (lo consume el Paso 1 para validar y mostrar el rango disponible).
   */
  @Get('config/number-start')
  numberStart() {
    return this.service.orderNumberStart();
  }

  /**
   * Disponibilidad de números de orden para el Paso 1. Sin `number` devuelve la
   * sugerencia (mayor en uso + 1); con `number` + `count` (proveedores de la
   * orden) dice si el bloque consecutivo está libre, qué números están tomados y
   * el primer bloque libre. Sólo JWT: es información de numeración, la usa el
   * formulario mientras el usuario escribe.
   */
  @Get('numbers/availability')
  numberAvailability(@Query() query: QueryOrderNumberDto) {
    return this.service.numberAvailability(query);
  }

  /** Historial de cambios por usuario de la orden (más reciente primero). */
  @RequirePermissions(PERMISSIONS.ORDERS.LIST)
  @Get(':id/history')
  history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.history(id, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.LIST)
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

  /**
   * Cambia el N° de orden de una orden ya creada (Paso 1). Renumera la orden
   * completa (base + una orden interna por proveedor) al bloque consecutivo que
   * arranca en el número dado.
   */
  @RequirePermissions(PERMISSIONS.ORDERS.CUSTOM_NUMBER)
  @Patch(':id/number')
  changeNumber(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeOrderNumberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeNumber(id, dto, user);
  }

  /**
   * Cancela la orden sin borrarla: conserva su número (no abre huecos en la
   * numeración) y congela el flujo. Reversible vía `uncancel`.
   */
  @RequirePermissions(PERMISSIONS.ORDERS.CANCEL)
  @Patch(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(id, dto, user);
  }

  /** Revierte la cancelación: la orden vuelve al estado que tenía antes. */
  @RequirePermissions(PERMISSIONS.ORDERS.CANCEL)
  @Patch(':id/uncancel')
  uncancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.uncancel(id, user);
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
