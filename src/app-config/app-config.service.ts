import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './entities/app-config.entity';

export const APP_CONFIG_KEYS = {
  CASHEA_COMMISSION_RATE: 'cashea.commissionRate',
  CASHEA_FINANCING_RATE: 'cashea.financingRate',
} as const;

const DEFAULT_COMMISSION_RATE = 0.0464;
const DEFAULT_FINANCING_RATE = 0.062;

const DEFAULTS: Record<string, string> = {
  [APP_CONFIG_KEYS.CASHEA_COMMISSION_RATE]: DEFAULT_COMMISSION_RATE.toFixed(4),
  [APP_CONFIG_KEYS.CASHEA_FINANCING_RATE]: DEFAULT_FINANCING_RATE.toFixed(4),
};

/** Configuración Cashea expresada como fracciones (0..1). */
export interface CasheaCommissionConfig {
  /** Fracción sobre el TOTAL de la venta (comisión). Ej. 0.0464 = 4.64%. */
  commissionRate: number;
  /** Fracción sobre el RESTANTE (total − inicial) — financiamiento. Ej. 0.062 = 6.2%. */
  financingRate: number;
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
    const [commission, financing] = await Promise.all([
      this.get(APP_CONFIG_KEYS.CASHEA_COMMISSION_RATE),
      this.get(APP_CONFIG_KEYS.CASHEA_FINANCING_RATE),
    ]);
    return {
      commissionRate: this.parseRate(commission, DEFAULT_COMMISSION_RATE),
      financingRate: this.parseRate(financing, DEFAULT_FINANCING_RATE),
    };
  }

  async setCasheaCommissionConfig(
    config: CasheaCommissionConfig,
  ): Promise<CasheaCommissionConfig> {
    await this.set(
      APP_CONFIG_KEYS.CASHEA_COMMISSION_RATE,
      config.commissionRate.toFixed(4),
    );
    await this.set(
      APP_CONFIG_KEYS.CASHEA_FINANCING_RATE,
      config.financingRate.toFixed(4),
    );
    return config;
  }
}
