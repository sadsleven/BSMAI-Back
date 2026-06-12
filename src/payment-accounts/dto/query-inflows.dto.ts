import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class QueryInflowsDto {
  /** Fecha desde (inclusive, YYYY-MM-DD). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Fecha hasta (inclusive, YYYY-MM-DD). */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Origen del dinero recibido. */
  @IsOptional()
  @IsIn(['orders', 'receivables', 'all'])
  source?: 'orders' | 'receivables' | 'all';

  /** Filtra por cuenta de pago específica. */
  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  /** Filtra por tipo de pago. */
  @IsOptional()
  @IsIn(['mobile_payment', 'bank_transfer', 'other'])
  type?: 'mobile_payment' | 'bank_transfer' | 'other';
}
