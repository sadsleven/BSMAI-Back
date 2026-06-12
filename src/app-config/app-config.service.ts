import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './entities/app-config.entity';

export const APP_CONFIG_KEYS = {
  CASHEA_FIRST_INSTALLMENT_RATE: 'cashea.firstInstallmentRate',
  CASHEA_TOTAL_RATE: 'cashea.totalRate',
} as const;

const DEFAULTS: Record<string, string> = {
  [APP_CONFIG_KEYS.CASHEA_FIRST_INSTALLMENT_RATE]: '0.04',
  [APP_CONFIG_KEYS.CASHEA_TOTAL_RATE]: '0.06',
};

/** Configuración de comisión Cashea expresada como fracciones (0..1). */
export interface CasheaCommissionConfig {
  /** Fracción sobre el monto de la primera cuota (inicial). Ej. 0.04 = 4%. */
  firstInstallmentRate: number;
  /** Fracción sobre el total de la orden. Ej. 0.06 = 6%. */
  totalRate: number;
}

@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(AppConfig) private readonly repo: Repository<AppConfig>,
  ) {}

  async get(key: string): Promise<string> {
    const row = await this.repo.findOne({ where: { key } });
    if (row) return row.value;
    const def = DEFAULTS[key];
    if (def === undefined) throw new NotFoundException(`Config ${key} no definida`);
    return def;
  }

  async set(key: string, value: string): Promise<AppConfig> {
    let row = await this.repo.findOne({ where: { key } });
    if (!row) {
      row = this.repo.create({ key, value });
    } else {
      row.value = value;
    }
    return this.repo.save(row);
  }

  private parseRate(raw: string, fallback: number): number {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  async getCasheaCommissionConfig(): Promise<CasheaCommissionConfig> {
    const [first, total] = await Promise.all([
      this.get(APP_CONFIG_KEYS.CASHEA_FIRST_INSTALLMENT_RATE),
      this.get(APP_CONFIG_KEYS.CASHEA_TOTAL_RATE),
    ]);
    return {
      firstInstallmentRate: this.parseRate(first, 0.04),
      totalRate: this.parseRate(total, 0.06),
    };
  }

  async setCasheaCommissionConfig(
    config: CasheaCommissionConfig,
  ): Promise<CasheaCommissionConfig> {
    await this.set(
      APP_CONFIG_KEYS.CASHEA_FIRST_INSTALLMENT_RATE,
      config.firstInstallmentRate.toFixed(4),
    );
    await this.set(
      APP_CONFIG_KEYS.CASHEA_TOTAL_RATE,
      config.totalRate.toFixed(4),
    );
    return config;
  }
}
