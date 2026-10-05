import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const BUDGET_STATUSES = [
  'draft',
  'sent',
  'approved',
  'rejected',
] as const;

export class ChangeBudgetStatusDto {
  @IsIn(BUDGET_STATUSES, { message: 'Estado inválido' })
  status: 'draft' | 'sent' | 'approved' | 'rejected';

  /** Obligatorio al pasar a `rejected`. Validado en service. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500, { message: 'Máximo 500 caracteres' })
  rejectReason?: string;
}
