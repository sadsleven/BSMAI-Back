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
import { ServiceTypesService } from './service-types.service';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { UpdateServiceTypeDto } from './dto/update-service-type.dto';
import { QueryServiceTypesDto } from './dto/query-service-types.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly service: ServiceTypesService) {}

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.LIST)
  @Get()
  findAll(@Query() query: QueryServiceTypesDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.LIST)
  @Get('assignable')
  findAssignable() {
    return this.service.findAssignable();
  }

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.VIEW)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.CREATE)
  @Post()
  create(@Body() dto: CreateServiceTypeDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.UPDATE)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateServiceTypeDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.SERVICE_TYPES.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
