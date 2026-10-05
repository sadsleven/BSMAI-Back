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
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { QueryBudgetsDto } from './dto/query-budgets.dto';
import { ChangeBudgetStatusDto } from './dto/change-budget-status.dto';
import { LinkBudgetOrderDto } from './dto/link-budget-order.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * Presupuestos de servicios. Mismo Paso 1 de la orden, sin el resto del flujo:
 * se arma, se exporta (Excel/PDF) y, si lo aceptan, se convierte en orden.
 */
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @RequirePermissions(PERMISSIONS.BUDGETS.LIST)
  @Get()
  findAll(@Query() query: QueryBudgetsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(query, user);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS.LIST)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS.CREATE)
  @Post()
  create(@Body() dto: CreateBudgetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBudgetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS.CHANGE_STATUS)
  @Patch(':id/status')
  changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeBudgetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.changeStatus(id, dto, user);
  }

  /**
   * Enlaza la orden creada desde este presupuesto. La llama el FE después de
   * crear la orden con el Paso 1 precargado.
   */
  @RequirePermissions(PERMISSIONS.BUDGETS.CONVERT)
  @Patch(':id/link-order')
  linkOrder(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: LinkBudgetOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.linkOrder(id, dto.orderId, user);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS.RESTORE)
  @Patch(':id/restore')
  restore(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.restore(id, user);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.softDelete(id, user);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.hardDelete(id, user);
  }
}
