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
import { PathologiesService } from './pathologies.service';
import { CreatePathologyDto } from './dto/create-pathology.dto';
import { UpdatePathologyDto } from './dto/update-pathology.dto';
import { QueryPathologiesDto } from './dto/query-pathologies.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('pathologies')
export class PathologiesController {
  constructor(private readonly service: PathologiesService) {}

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.LIST)
  @Get()
  findAll(@Query() query: QueryPathologiesDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.LIST)
  @Get('assignable')
  findAssignable() {
    return this.service.findAssignable();
  }

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.VIEW)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.CREATE)
  @Post()
  create(@Body() dto: CreatePathologyDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.UPDATE)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdatePathologyDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.PATHOLOGIES.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
