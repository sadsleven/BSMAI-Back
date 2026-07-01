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
} from '@nestjs/common';
import { OrderDraftsService } from './order-drafts.service';
import { SaveOrderDraftDto } from './dto/save-order-draft.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * Borradores parciales del Paso 1. Gateados con `orders.create`: quien puede
 * crear órdenes puede guardar y retomar borradores propios.
 */
@Controller('order-drafts')
export class OrderDraftsController {
  constructor(private readonly service: OrderDraftsService) {}

  @RequirePermissions(PERMISSIONS.ORDERS.CREATE)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.CREATE)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.CREATE)
  @Post()
  create(
    @Body() dto: SaveOrderDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.CREATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SaveOrderDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @RequirePermissions(PERMISSIONS.ORDERS.CREATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user);
  }
}
