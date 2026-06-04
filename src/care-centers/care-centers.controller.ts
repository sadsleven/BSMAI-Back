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
import { CareCentersService } from './care-centers.service';
import { CreateCareCenterDto } from './dto/create-care-center.dto';
import { UpdateCareCenterDto } from './dto/update-care-center.dto';
import { QueryCareCentersDto } from './dto/query-care-centers.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('care-centers')
export class CareCentersController {
  constructor(private readonly service: CareCentersService) {}

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.LIST)
  @Get()
  findAll(@Query() query: QueryCareCentersDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.LIST)
  @Get('assignable')
  findAssignable() {
    return this.service.findAssignable();
  }

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.CREATE)
  @Post()
  create(@Body() dto: CreateCareCenterDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.UPDATE)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateCareCenterDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.CARE_CENTERS.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
