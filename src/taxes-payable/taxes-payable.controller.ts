import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { TaxesPayableService } from './taxes-payable.service';
import {
  QueryTaxesPayableDto,
  RegisterTaxPaymentDto,
} from './dto/register-tax-payment.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('taxes-payable')
export class TaxesPayableController {
  constructor(private readonly service: TaxesPayableService) {}

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.LIST)
  @Get()
  findAll(@Query() query: QueryTaxesPayableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(query, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.VIEW)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions(PERMISSIONS.TAXES_PAYABLE.UPDATE)
  @Post('register-payment')
  registerPayment(@Body() dto: RegisterTaxPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.registerPayment(dto, user);
  }
}
