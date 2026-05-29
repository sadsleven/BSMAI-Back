import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreditsReceivableService } from './credits-receivable.service';
import {
  QueryCreditsReceivableDto,
  RegisterCreditCollectionDto,
} from './dto/register-collection.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('credits-receivable')
export class CreditsReceivableController {
  constructor(private readonly service: CreditsReceivableService) {}

  @RequirePermissions(PERMISSIONS.CREDITS_RECEIVABLE.LIST)
  @Get()
  findAll(
    @Query() query: QueryCreditsReceivableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @RequirePermissions(PERMISSIONS.CREDITS_RECEIVABLE.VIEW)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions(PERMISSIONS.CREDITS_RECEIVABLE.UPDATE)
  @Post('register-collection')
  registerCollection(
    @Body() dto: RegisterCreditCollectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registerCollection(dto, user);
  }
}
