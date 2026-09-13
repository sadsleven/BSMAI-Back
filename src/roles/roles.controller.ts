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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { QueryRolesDto } from './dto/query-roles.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @RequirePermissions(PERMISSIONS.ROLES.LIST)
  @Get()
  findAll(@Query() query: QueryRolesDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.ROLES.LIST)
  @Get('assignable')
  findAssignable() {
    return this.service.findAssignable();
  }

  @RequirePermissions(PERMISSIONS.ROLES.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.ROLES.CREATE)
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES.ASSIGN_PERMISSIONS)
  @Patch(':id/permissions')
  assignPermissions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.service.assignPermissions(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.ROLES.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.ROLES.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }

  @RequirePermissions(PERMISSIONS.ROLES.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }
}
