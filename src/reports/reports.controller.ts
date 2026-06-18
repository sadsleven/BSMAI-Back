import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  QueryPayablesReportDto,
  QueryReceivablesReportDto,
  QueryReportsDto,
} from './dto/query-reports.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  /**
   * Cuentas por pagar — completo (incluye Pendientes sin lote) y exacto en Bs.
   * `groupBy=provider` agrupa por proveedor (alimenta "Producción por médico").
   */
  @RequirePermissions(PERMISSIONS.REPORTS.PAYABLES_LIST)
  @Get('payables')
  payables(
    @Query() query: QueryPayablesReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.payables(query, user);
  }

  /**
   * Cuentas por cobrar — completo y exacto. `groupBy=insurance|holder` agrupa por
   * deudor (alimenta "Producción por aseguradora").
   */
  @RequirePermissions(PERMISSIONS.REPORTS.RECEIVABLES_LIST)
  @Get('receivables')
  receivables(
    @Query() query: QueryReceivablesReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.receivables(query, user);
  }

  /** Retenciones (impuestos retenidos) — una fila por obligación, incluye sin lote. */
  @RequirePermissions(PERMISSIONS.REPORTS.TAXES_RETAINED_LIST)
  @Get('taxes-retained')
  taxesRetained(
    @Query() query: QueryReportsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.taxesRetained(query, user);
  }

  /** Pagos emitidos a proveedores (dinero que salió). Filtra por paymentDate. */
  @RequirePermissions(PERMISSIONS.REPORTS.DISBURSEMENTS_LIST)
  @Get('disbursements')
  disbursements(
    @Query() query: QueryReportsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.disbursements(query, user);
  }

  /** Cobros recibidos (dinero que entró). Filtra por paymentDate. */
  @RequirePermissions(PERMISSIONS.REPORTS.COLLECTIONS_LIST)
  @Get('collections')
  collections(
    @Query() query: QueryReportsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.collections(query, user);
  }

  /** Antigüedad de saldos pendientes (buckets por días de orderDate). */
  @RequirePermissions(PERMISSIONS.REPORTS.AGING_LIST)
  @Get('aging')
  aging(@Query() query: QueryReportsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.aging(query, user);
  }
}
