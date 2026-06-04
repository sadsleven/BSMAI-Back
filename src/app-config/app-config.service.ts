import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './entities/app-config.entity';

export const APP_CONFIG_KEYS = {
  CASHEA_COMMISSION_RATE: 'cashea.commissionRate',
} as const;

const DEFAULTS: Record<string, string> = {
  [APP_CONFIG_KEYS.CASHEA_COMMISSION_RATE]: '0.10',
};

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

  async getCasheaCommissionRate(): Promise<number> {
    const raw = await this.get(APP_CONFIG_KEYS.CASHEA_COMMISSION_RATE);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0.1;
  }

  async setCasheaCommissionRate(rate: number): Promise<{ commissionRate: number }> {
    await this.set(APP_CONFIG_KEYS.CASHEA_COMMISSION_RATE, rate.toFixed(4));
    return { commissionRate: rate };
  }
}
