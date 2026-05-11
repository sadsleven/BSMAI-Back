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
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientsDto } from './dto/query-patients.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';

@Controller('patients')
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  @RequirePermissions(PERMISSIONS.PATIENTS.LIST)
  @Get()
  findAll(@Query() query: QueryPatientsDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS.VIEW)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS.VIEW)
  @Get(':id/available-insurances')
  availableInsurances(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getAvailableInsurances(id);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS.CREATE)
  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.service.create(dto);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS.UPDATE)
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdatePatientDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.PATIENTS.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
