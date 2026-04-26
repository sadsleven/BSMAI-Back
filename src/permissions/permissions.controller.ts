import { Controller, Get } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from './permissions.catalog';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @RequirePermissions(PERMISSIONS.PERMISSIONS.LIST)
  @Get()
  async findAll() {
    return this.service.findAll();
  }
}
