import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
