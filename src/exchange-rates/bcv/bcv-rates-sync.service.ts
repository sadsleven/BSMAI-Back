import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CURRENCIES, Currency, ExchangeRate } from '../entities/exchange-rate.entity';
import { BcvScraperService, BcvScrapedRates } from './bcv-scraper.service';
import { VE_TIME_ZONE } from './bcv.constants';
import { isDayAfter, veDay, veDayStartIso, veNextDay } from './ve-date.util';
import { isServerlessRuntime } from '../../shared/utils/runtime.util';

export type BcvRateAction = 'created' | 'unchanged';

export interface BcvSyncResult {
  /** `true` si se leyó el BCV; `false` si se omitió por alguna guarda. */
  ran: boolean;
  /** Motivo de la omisión, cuando `ran` es `false`. */
  skippedReason?: string;
  /** `Fecha Valor` publicada por el BCV (ISO con offset VE). */
  effectiveDate?: string;
  rates?: Array<{ currency: Currency; amountBs: number; action: BcvRateAction }>;
}

/**
 * Sincroniza las tasas USD/EUR desde la página del BCV.
 *
 * Cómo publica el BCV:
 *  - Sólo días de semana (lunes a viernes), una vez al día, entre 3:00 pm y
 *    6:00 pm hora de Venezuela.
 *  - La tasa que publica es la del PRÓXIMO día hábil: el viernes por la tarde
 *    publica la del lunes. Por eso la fecha efectiva se toma de `Fecha Valor`
 *    de la página y no del momento en que se corre el cron.
 *
 * Cron: cada 15 minutos de 3:00 pm a 7:45 pm, lunes a viernes, en hora de
 * Venezuela. En cuanto consigue una `Fecha Valor` futura (posterior a hoy) deja
 * de consultar el resto del día. Un segundo cron a las 8:00 am recupera la
 * publicación si el servidor estuvo caído la tarde anterior.
 *
 * En serverless (Vercel/Lambda) los cron NO se registran: no hay proceso de
 * larga vida. El endpoint manual `POST /exchange-rates/sync-bcv` sí funciona en
 * ambos entornos.
 */
@Injectable()
export class BcvRatesSyncService implements OnModuleInit {
  private readonly logger = new Logger('BcvRatesSync');

  /** Día VE en el que ya se obtuvo una tasa con fecha futura → no reconsultar. */
  private satisfiedForDay: string | null = null;
  /** Evita solapes si una corrida se alarga más que el intervalo del cron. */
  private running = false;

  constructor(
    @InjectRepository(ExchangeRate) private readonly repo: Repository<ExchangeRate>,
    private readonly scraper: BcvScraperService,
  ) {}

  /** El cron corre salvo en serverless o si `BCV_CRON_ENABLED=false`. */
  private get cronEnabled(): boolean {
    if (isServerlessRuntime()) return false;
    return process.env.BCV_CRON_ENABLED !== 'false';
  }

  onModuleInit(): void {
    if (isServerlessRuntime()) {
      this.logger.log(
        'Cron del BCV desactivado: el backend corre en modo serverless. Usa POST /exchange-rates/sync-bcv.',
      );
      return;
    }
    if (process.env.BCV_CRON_ENABLED === 'false') {
      this.logger.warn('Cron del BCV desactivado por BCV_CRON_ENABLED=false.');
      return;
    }

    this.logger.log(
      `Cron del BCV activo (lunes a viernes, 3:00 pm–7:45 pm ${VE_TIME_ZONE}, cada 15 min).`,
    );

    if (process.env.BCV_SYNC_ON_BOOT === 'true') {
      // Sin await: no bloquea el arranque de la aplicación.
      void this.runGuarded('arranque');
    }
  }

  /** Ventana de publicación: cada 15 min, 3:00 pm–7:45 pm, lunes a viernes. */
  @Cron('0 */15 15-19 * * 1-5', {
    name: 'bcv-rates-sync',
    timeZone: VE_TIME_ZONE,
  })
  async handlePublicationWindow(): Promise<void> {
    if (!this.cronEnabled) return;
    await this.runGuarded('ventana de publicación');
  }

  /**
   * Red de seguridad matutina: si el servidor estuvo caído en la ventana de
   * ayer, la tasa vigente quedó desactualizada. Una sola consulta a las 8:00 am.
   */
  @Cron('0 0 8 * * 1-5', {
    name: 'bcv-rates-catchup',
    timeZone: VE_TIME_ZONE,
  })
  async handleMorningCatchup(): Promise<void> {
    if (!this.cronEnabled) return;
    await this.runGuarded('recuperación matutina');
  }

  /**
   * Corrida manual (endpoint). `force` ignora la guarda de "ya tengo la tasa"
   * pero nunca sobreescribe: si el monto ya está guardado, no crea filas.
   */
  async syncNow(force = false): Promise<BcvSyncResult> {
    if (this.running) {
      return { ran: false, skippedReason: 'Ya hay una sincronización en curso' };
    }
    return this.sync(force);
  }

  /** Envoltura para los cron: nunca lanza, sólo registra. */
  private async runGuarded(trigger: string): Promise<void> {
    try {
      const result = await this.sync(false);
      if (!result.ran) {
        this.logger.debug(`[${trigger}] omitido: ${result.skippedReason}`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${trigger}] falló la sincronización con el BCV: ${reason}`);
    }
  }

  private async sync(force: boolean): Promise<BcvSyncResult> {
    if (this.running) {
      return { ran: false, skippedReason: 'Ya hay una sincronización en curso' };
    }

    const today = veDay();

    if (!force) {
      if (this.satisfiedForDay === today) {
        return { ran: false, skippedReason: `Ya se obtuvo la tasa futura hoy (${today})` };
      }
      // Tras un reinicio la memoria está vacía: se consulta la BD antes de
      // salir a internet.
      if (await this.hasFutureRates(today)) {
        this.satisfiedForDay = today;
        return {
          ran: false,
          skippedReason: `Ya hay tasas guardadas con fecha posterior a hoy (${today})`,
        };
      }
    }

    this.running = true;
    try {
      const scraped = await this.scraper.scrape();
      const rates = await this.persistAll(scraped);

      const created = rates.filter((r) => r.action === 'created');
      if (created.length) {
        this.logger.log(
          `BCV ${scraped.effectiveDay}: ${created
            .map((r) => `${r.currency}=${r.amountBs.toFixed(2)} Bs`)
            .join(', ')}`,
        );
      } else {
        this.logger.debug(`BCV ${scraped.effectiveDay}: sin cambios respecto a lo guardado.`);
      }

      // Publicada la tasa del próximo día hábil → no hay nada más que esperar hoy.
      if (isDayAfter(scraped.effectiveDay, today)) {
        this.satisfiedForDay = today;
      }

      return { ran: true, effectiveDate: scraped.effectiveDate, rates };
    } finally {
      this.running = false;
    }
  }

  /** `true` si USD y EUR ya tienen una tasa con fecha efectiva futura. */
  private async hasFutureRates(today: string): Promise<boolean> {
    const startOfTomorrow = veDayStartIso(veNextDay(today));
    const counts = await Promise.all(
      CURRENCIES.map((currency) => this.countFrom(currency, startOfTomorrow)),
    );
    return counts.every((count) => count > 0);
  }

  /** Tasas activas de la moneda con fecha efectiva a partir de `fromIso`. */
  private countFrom(currency: Currency, fromIso: string): Promise<number> {
    return this.repo
      .createQueryBuilder('rate')
      .where('rate.currency = :currency', { currency })
      .andWhere('rate.isActive = true')
      .andWhere('rate.effectiveDate >= :from', { from: fromIso })
      .getCount();
  }

  private async persistAll(
    scraped: BcvScrapedRates,
  ): Promise<Array<{ currency: Currency; amountBs: number; action: BcvRateAction }>> {
    const pairs: Array<[Currency, number]> = [
      ['USD', scraped.usdBs],
      ['EUR', scraped.eurBs],
    ];

    const results: Array<{ currency: Currency; amountBs: number; action: BcvRateAction }> = [];
    for (const [currency, amountBs] of pairs) {
      const action = await this.persist(currency, amountBs, scraped);
      results.push({ currency, amountBs, action });
    }
    return results;
  }

  /**
   * Inserta la tasa si no está. Nunca sobreescribe: el histórico de
   * `exchange_rates` es inmutable, un cambio de monto es una fila nueva.
   */
  private async persist(
    currency: Currency,
    amountBs: number,
    scraped: BcvScrapedRates,
  ): Promise<BcvRateAction> {
    const dayStart = veDayStartIso(scraped.effectiveDay);
    const dayEnd = veDayStartIso(veNextDay(scraped.effectiveDay));

    const sameDay = await this.repo
      .createQueryBuilder('rate')
      .where('rate.currency = :currency', { currency })
      .andWhere('rate.effectiveDate >= :from', { from: dayStart })
      .andWhere('rate.effectiveDate < :to', { to: dayEnd })
      .orderBy('rate.effectiveDate', 'DESC')
      .addOrderBy('rate.createdAt', 'DESC')
      .getMany();

    const cents = Math.round(amountBs * 100);
    const alreadySaved = sameDay.some(
      (rate) => Math.round(Number(rate.amountBs) * 100) === cents,
    );
    if (alreadySaved) return 'unchanged';

    await this.repo.save(
      this.repo.create({
        currency,
        amountBs: amountBs.toFixed(2),
        effectiveDate: scraped.effectiveDate,
        isActive: true,
      }),
    );
    return 'created';
  }
}
