import {
  BadRequestException,
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
import { ExchangeRatesService } from './exchange-rates.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';
import { QueryExchangeRatesDto } from './dto/query-exchange-rates.dto';
import { CURRENCIES, Currency } from './entities/exchange-rate.entity';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { BcvRatesSyncService } from './bcv/bcv-rates-sync.service';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(
    private readonly service: ExchangeRatesService,
    private readonly bcvSync: BcvRatesSyncService,
  ) {}

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.LIST)
  @Get()
  findAll(@Query() query: QueryExchangeRatesDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.LIST)
  @Get('current')
  findCurrent(@Query('currency') currency?: string) {
    if (!currency || !CURRENCIES.includes(currency as Currency)) {
      throw new BadRequestException('La moneda debe ser USD o EUR');
    }
    return this.service.findCurrent(currency as Currency);
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.LIST)
  @Get('current-summary')
  findCurrentSummary() {
    return this.service.findCurrentSummary();
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.LIST)
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id, true);
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.CREATE)
  @Post()
  create(@Body() dto: CreateExchangeRateDto) {
    return this.service.create(dto);
  }

  /**
   * Lee la página del BCV y guarda las tasas USD/EUR publicadas. Es la misma
   * operación que corre el cron; sirve para forzarla a mano y funciona también
   * cuando el backend está desplegado en modo serverless (donde el cron no
   * corre). `force=true` ignora la guarda de "ya se obtuvo la tasa de hoy";
   * nunca sobreescribe filas: si el monto ya está guardado, no crea nada.
   */
  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.CREATE)
  @Post('sync-bcv')
  syncBcv(@Query('force') force?: string) {
    return this.bcvSync.syncNow(force === 'true');
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.UPDATE)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExchangeRateDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.TOGGLE_ACTIVE)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.toggleActive(id);
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  softDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.softDelete(id);
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.HARD_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.hardDelete(id);
  }

  @RequirePermissions(PERMISSIONS.EXCHANGE_RATES.RESTORE)
  @Patch(':id/restore')
  restore(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.restore(id);
  }
}
