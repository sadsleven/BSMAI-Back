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
import { ContractorsService } from './contractors.service';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';
import { QueryContractorsDto } from './dto/query-contractors.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('contractors')
export class ContractorsController {
  constructor(private readonly service: ContractorsService) {}

  @RequirePermissions(PERMISSIONS.CONTRACTORS.LIST)
  @Get()
  findAll(@Query() query: QueryContractorsDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.CONTRACTORS.LIST)
  @Get('assignable')
  findAssignable() {
    return this.service.findAssignable();
  }

  @RequirePermissions(PERMISSIONS.CONTRACTORS.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.CONTRACTORS.CREATE)
  @Post()
  create(@Body() dto: CreateContractorDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.CONTRACTORS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContractorDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.CONTRACTORS.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.CONTRACTORS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.CONTRACTORS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.CONTRACTORS.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
