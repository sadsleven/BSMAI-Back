import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AccountsReceivableService } from './accounts-receivable.service';
import {
  QueryAccountsReceivableDto,
  RegisterCollectionDto,
} from './dto/register-collection.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('accounts-receivable')
export class AccountsReceivableController {
  constructor(private readonly service: AccountsReceivableService) {}

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.LIST)
  @Get()
  findAll(
    @Query() query: QueryAccountsReceivableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.VIEW)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions(PERMISSIONS.ACCOUNTS_RECEIVABLE.UPDATE)
  @Post('register-collection')
  registerCollection(
    @Body() dto: RegisterCollectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registerCollection(dto, user);
  }
}
