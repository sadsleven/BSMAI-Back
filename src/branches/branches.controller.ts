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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('branches')
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @RequirePermissions(PERMISSIONS.BRANCHES.LIST)
  @Get()
  findAll(@Query() query: QueryBranchesDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.BRANCHES.LIST)
  @Get('assignable')
  findAssignable() {
    return this.service.findAssignable();
  }

  @RequirePermissions(PERMISSIONS.BRANCHES.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.BRANCHES.CREATE)
  @Post()
  create(@Body() dto: CreateBranchDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.BRANCHES.UPDATE)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateBranchDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BRANCHES.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.BRANCHES.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.BRANCHES.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.BRANCHES.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
