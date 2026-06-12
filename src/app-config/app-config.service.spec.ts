import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AppConfigService, APP_CONFIG_KEYS } from './app-config.service';
import { AppConfig } from './entities/app-config.entity';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let store: Map<string, string>;
  let repo: jest.Mocked<Pick<Repository<AppConfig>, 'findOne' | 'create' | 'save'>>;

  beforeEach(() => {
    store = new Map();
    repo = {
      findOne: jest.fn(async ({ where: { key } }: { where: { key: string } }) =>
        store.has(key) ? ({ key, value: store.get(key)! } as AppConfig) : null,
      ),
      create: jest.fn((data: Partial<AppConfig>) => data as AppConfig),
      save: jest.fn(async (row: AppConfig) => {
        store.set(row.key, row.value);
        return row;
      }),
    } as unknown as jest.Mocked<
      Pick<Repository<AppConfig>, 'findOne' | 'create' | 'save'>
    >;
    service = new AppConfigService(repo as unknown as Repository<AppConfig>);
  });

  describe('get', () => {
    it('devuelve el default cuando no hay fila', async () => {
      const v = await service.get(APP_CONFIG_KEYS.CASHEA_FIRST_INSTALLMENT_RATE);
      expect(v).toBe('0.04');
    });

    it('devuelve el valor almacenado cuando existe', async () => {
      store.set(APP_CONFIG_KEYS.CASHEA_TOTAL_RATE, '0.0750');
      const v = await service.get(APP_CONFIG_KEYS.CASHEA_TOTAL_RATE);
      expect(v).toBe('0.0750');
    });

    it('lanza NotFound para key desconocida sin default', async () => {
      await expect(service.get('cashea.unknown')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getCasheaCommissionConfig', () => {
    it('devuelve defaults 0.04 / 0.06 sin filas', async () => {
      const cfg = await service.getCasheaCommissionConfig();
      expect(cfg).toEqual({ firstInstallmentRate: 0.04, totalRate: 0.06 });
    });

    it('parsea las filas almacenadas a número', async () => {
      store.set(APP_CONFIG_KEYS.CASHEA_FIRST_INSTALLMENT_RATE, '0.0300');
      store.set(APP_CONFIG_KEYS.CASHEA_TOTAL_RATE, '0.0800');
      const cfg = await service.getCasheaCommissionConfig();
      expect(cfg).toEqual({ firstInstallmentRate: 0.03, totalRate: 0.08 });
    });

    it('usa fallback si el valor almacenado no es numérico', async () => {
      store.set(APP_CONFIG_KEYS.CASHEA_FIRST_INSTALLMENT_RATE, 'x');
      const cfg = await service.getCasheaCommissionConfig();
      expect(cfg.firstInstallmentRate).toBe(0.04);
    });
  });

  describe('setCasheaCommissionConfig', () => {
    it('persiste ambas tasas con 4 decimales y las devuelve', async () => {
      const result = await service.setCasheaCommissionConfig({
        firstInstallmentRate: 0.04,
        totalRate: 0.06,
      });
      expect(result).toEqual({ firstInstallmentRate: 0.04, totalRate: 0.06 });
      expect(store.get(APP_CONFIG_KEYS.CASHEA_FIRST_INSTALLMENT_RATE)).toBe('0.0400');
      expect(store.get(APP_CONFIG_KEYS.CASHEA_TOTAL_RATE)).toBe('0.0600');
    });

    it('round-trip: set luego getCasheaCommissionConfig', async () => {
      await service.setCasheaCommissionConfig({
        firstInstallmentRate: 0.05,
        totalRate: 0.07,
      });
      const cfg = await service.getCasheaCommissionConfig();
      expect(cfg).toEqual({ firstInstallmentRate: 0.05, totalRate: 0.07 });
    });
  });
});
