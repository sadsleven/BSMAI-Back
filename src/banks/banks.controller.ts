import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { BanksService } from './banks.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

/**
 * Catálogo de bancos venezolanos para Pago Móvil / transferencias.
 * El listado sólo requiere JWT — se usa para popular selects en formularios
 * de cualquier usuario. Las mutaciones (Administración) sí exigen permisos.
 */
@Controller('banks')
export class BanksController {
  constructor(private readonly service: BanksService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @RequirePermissions(PERMISSIONS.BANKS.CREATE)
  @Post()
  create(@Body() dto: CreateBankDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.BANKS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBankDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BANKS.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }
}
