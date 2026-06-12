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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @RequirePermissions(PERMISSIONS.USERS.LIST)
  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.USERS.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.USERS.CREATE)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.USERS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, actor);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/change-password')
  changePassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.changePassword(id, dto, actor);
  }

  @RequirePermissions(PERMISSIONS.USERS.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.toggleActive(id, actor);
  }

  @RequirePermissions(PERMISSIONS.USERS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.softDelete(id, actor);
  }

  @RequirePermissions(PERMISSIONS.USERS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.hardDelete(id, actor);
  }

  @RequirePermissions(PERMISSIONS.USERS.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
