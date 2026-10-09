import { IsUUID } from 'class-validator';

export class LinkBudgetOrderDto {
  /** Orden recién creada desde el presupuesto. */
  @IsUUID()
  orderId: string;
}
