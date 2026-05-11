import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Endpoints públicos de configuración.
 * Expone constantes derivadas de `.env` que el FE necesita conocer al runtime.
 */
@Controller('config')
export class AppConfigController {
  constructor(private readonly config: ConfigService) {}

  /** Tasas de impuesto del doctor — natural y jurídico — leídas desde `.env`. */
  @Public()
  @Get('tax-rates')
  getTaxRates(): { doctorNaturalTaxRate: number; doctorLegalTaxRate: number } {
    return {
      doctorNaturalTaxRate:
        this.parseRate(this.config.get<string>('DOCTOR_NATURAL_TAX_RATE'), 0.03),
      doctorLegalTaxRate:
        this.parseRate(this.config.get<string>('DOCTOR_LEGAL_TAX_RATE'), 0.05),
    };
  }

  private parseRate(raw: string | undefined, fallback: number): number {
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
    return n;
  }
}
