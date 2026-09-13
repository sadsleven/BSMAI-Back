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
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { QueryDoctorsDto } from './dto/query-doctors.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly service: DoctorsService) {}

  @RequirePermissions(PERMISSIONS.DOCTORS.LIST)
  @Get()
  findAll(@Query() query: QueryDoctorsDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.LIST)
  @Get('assignable')
  findAssignable() {
    return this.service.findAssignable();
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.CREATE)
  @Post()
  create(@Body() dto: CreateDoctorDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.CHANGE_PASSWORD)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/change-password')
  changePassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.service.changePassword(id, dto);
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.DOCTORS.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
