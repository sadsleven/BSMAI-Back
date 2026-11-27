import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/**
 * Filtros comunes a todos los reportes financieros. Las fechas filtran sobre
 * `orders.orderDate` (salvo disbursements/collections, que filtran por
 * `paymentDate` del pago). El scope de sucursal se aplica SIEMPRE en el backend.
 */
export class QueryReportsDto {
  /** Fecha desde (YYYY-MM-DD), inclusive, sobre orders.orderDate. */
  @IsOptional()
  @IsString()
  from?: string;

  /** Fecha hasta (YYYY-MM-DD), inclusive, sobre orders.orderDate. */
  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  careCenterId?: string;

  @IsOptional()
  @IsUUID()
  insuranceId?: string;

  @IsOptional()
  @IsUUID()
  holderId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Antigüedad mínima en días de la obligación. Cuentas por cobrar: fecha de
   * la factura (fallback: creación de la orden, p. ej. Cashea/crédito sin
   * factura). Cuentas por pagar: fecha de creación de la orden. Mínimo 10.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  ageDays?: number;
}

export class QueryPayablesReportDto extends QueryReportsDto {
  /** Si es 'provider', agrupa por proveedor; sino, una fila por obligación. */
  @IsOptional()
  @IsIn(['provider'])
  groupBy?: 'provider';
}

export class QueryReceivablesReportDto extends QueryReportsDto {
  @IsOptional()
  @IsIn(['insurance', 'holder'])
  groupBy?: 'insurance' | 'holder';

  /**
   * Tipo de deudor. Sustituye al uso histórico de `status` para lo mismo, que
   * se sigue aceptando por compatibilidad con los enlaces guardados.
   */
  @IsOptional()
  @IsIn(['insurance', 'holder'])
  debtorType?: 'insurance' | 'holder';

  /**
   * Estado de cobro del lote. `uncollected` incluye las órdenes aún sin lote
   * (el FE las etiqueta igual: "Por cobrar"). Sin valor = todas.
   */
  @IsOptional()
  @IsIn([
    'uncollected',
    'partially_collected',
    'collected',
  ])
  state?:
    | 'uncollected'
    | 'partially_collected'
    | 'collected';
}

/**
 * Filtros del comprobante ARC (Agente de Retención, Decreto 1.808). El período
 * fiscal se resuelve así: `year` → 01-01 a 31-12 de ese año; sino `from`/`to`;
 * sino el año calendario actual. Filtra por la fecha de abono (pago al proveedor).
 */
export class QueryArcReportDto extends QueryReportsDto {
  /** Año fiscal (YYYY). Tiene prioridad sobre from/to. */
  @IsOptional()
  @IsString()
  year?: string;
}

/**
 * Filtros de los reportes basados en FACTURAS (`order_invoices`): "Facturas" y
 * "Relación de ingresos". A diferencia del resto, `from`/`to` filtran sobre
 * `order_invoices.invoiceDate` (la fecha de emisión), no sobre `orders.orderDate`.
 */
export class QueryInvoicesReportDto extends QueryReportsDto {
  /** Estado de la factura: vigente o anulada. Sin valor = ambas. */
  @IsOptional()
  @IsIn(['active', 'cancelled'])
  status?: 'active' | 'cancelled';

  /** Tipo de cliente de la factura (deudor del documento). */
  @IsOptional()
  @IsIn(['insurance', 'holder'])
  clientType?: 'insurance' | 'holder';
}
