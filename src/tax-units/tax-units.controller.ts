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
import { TaxUnitsService } from './tax-units.service';
import { CreateTaxUnitDto } from './dto/create-tax-unit.dto';
import { UpdateTaxUnitDto } from './dto/update-tax-unit.dto';
import { QueryTaxUnitsDto } from './dto/query-tax-units.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('tax-units')
export class TaxUnitsController {
  constructor(private readonly service: TaxUnitsService) {}

  @RequirePermissions(PERMISSIONS.TAX_UNITS.LIST)
  @Get()
  findAll(@Query() query: QueryTaxUnitsDto) {
    return this.service.findAll(query);
  }

  /** UT vigente al día de hoy (más reciente con effectiveDate <= hoy). */
  @RequirePermissions(PERMISSIONS.TAX_UNITS.LIST)
  @Get('current')
  findCurrent() {
    return this.service.findCurrent();
  }

  @RequirePermissions(PERMISSIONS.TAX_UNITS.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.TAX_UNITS.CREATE)
  @Post()
  create(@Body() dto: CreateTaxUnitDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.TAX_UNITS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaxUnitDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.TAX_UNITS.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.TAX_UNITS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.TAX_UNITS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.TAX_UNITS.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
