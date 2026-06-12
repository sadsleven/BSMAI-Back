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
import { SpecialtiesService } from './specialties.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';
import { QuerySpecialtiesDto } from './dto/query-specialties.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly service: SpecialtiesService) {}

  @RequirePermissions(PERMISSIONS.SPECIALTIES.LIST)
  @Get()
  findAll(@Query() query: QuerySpecialtiesDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.SPECIALTIES.LIST)
  @Get('assignable')
  findAssignable() {
    return this.service.findAssignable();
  }

  @RequirePermissions(PERMISSIONS.SPECIALTIES.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.SPECIALTIES.CREATE)
  @Post()
  create(@Body() dto: CreateSpecialtyDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SPECIALTIES.UPDATE)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SPECIALTIES.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.SPECIALTIES.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.SPECIALTIES.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.SPECIALTIES.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
