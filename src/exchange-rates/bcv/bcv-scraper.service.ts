import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { Agent } from 'https';
import {
  BCV_CURRENCY_ELEMENT_ID,
  BCV_DATE_CONTAINER_CLASSES,
  BCV_DEFAULT_URL,
  SPANISH_MONTHS,
  VE_UTC_OFFSET,
} from './bcv.constants';
import { veDayOf } from './ve-date.util';
import { Currency } from '../entities/exchange-rate.entity';

export interface BcvScrapedRates {
  /** Bs por 1 USD, a 2 decimales TRUNCADOS (`423,4562772` → `423.45`). */
  usdBs: number;
  /** Bs por 1 EUR, a 2 decimales TRUNCADOS. */
  eurBs: number;
  /** `Fecha Valor` del BCV como ISO 8601 con offset de Venezuela. */
  effectiveDate: string;
  /** Día calendario (`YYYY-MM-DD`) de `effectiveDate` en hora de Venezuela. */
  effectiveDay: string;
}

/**
 * Lee el tipo de cambio de referencia publicado en la home del BCV.
 *
 * La página es HTML estático renderizado en el servidor (Drupal): no hace falta
 * un navegador headless, basta una petición HTTP y parseo con regex. Se evita
 * así meter Chromium (~400 MB) en la imagen de Docker.
 *
 * Si el BCV algún día pasa a renderizar los montos por JavaScript, hay que
 * reemplazar `fetchHtml()` por Puppeteer y habilitar Chromium en el Dockerfile
 * (el bloque ya está comentado ahí).
 */
@Injectable()
export class BcvScraperService {
  private readonly logger = new Logger('BcvScraper');

  private get url(): string {
    return process.env.BCV_URL || BCV_DEFAULT_URL;
  }

  private get timeoutMs(): number {
    const parsed = Number(process.env.BCV_HTTP_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25_000;
  }

  /**
   * El certificado de `bcv.org.ve` tiene la cadena incompleta y Node rechaza la
   * conexión (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). Se acepta sin verificar
   * SÓLO para este host: es una lectura pública, no se envían credenciales ni
   * datos del sistema. Ponlo en `false` si el BCV arregla su cadena.
   */
  private get tlsInsecure(): boolean {
    return process.env.BCV_TLS_INSECURE !== 'false';
  }

  /** Descarga y parsea la página. Lanza si no puede obtener datos usables. */
  async scrape(): Promise<BcvScrapedRates> {
    const html = await this.fetchHtml();

    const usdBs = this.extractAmount(html, 'USD');
    const eurBs = this.extractAmount(html, 'EUR');
    const effectiveDate = this.extractEffectiveDate(html);

    return {
      usdBs,
      eurBs,
      effectiveDate,
      effectiveDay: veDayOf(effectiveDate),
    };
  }

  private async fetchHtml(): Promise<string> {
    const attempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await axios.get<string>(this.url, {
          timeout: this.timeoutMs,
          responseType: 'text',
          maxRedirects: 3,
          // El BCV responde 403 a clientes sin User-Agent de navegador.
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-VE,es;q=0.9',
            'Cache-Control': 'no-cache',
          },
          httpsAgent: new Agent({ rejectUnauthorized: !this.tlsInsecure }),
        });

        if (typeof res.data !== 'string' || res.data.length < 1000) {
          throw new Error('Respuesta del BCV vacía o demasiado corta');
        }
        return res.data;
      } catch (error) {
        lastError = error;
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Intento ${attempt}/${attempts} falló al leer el BCV: ${reason}`);
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
        }
      }
    }

    throw new ServiceUnavailableException(
      `No se pudo leer la página del BCV: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  /** Monto de una moneda desde su div (`#dolar` / `#euro`). */
  private extractAmount(html: string, currency: Currency): number {
    const id = BCV_CURRENCY_ELEMENT_ID[currency];
    const pattern = new RegExp(
      `id="${id}"[\\s\\S]{0,1500}?<strong[^>]*>\\s*([0-9][0-9.,\\s]*)\\s*</strong>`,
      'i',
    );
    const match = pattern.exec(html);
    if (!match) {
      throw new ServiceUnavailableException(
        `No se encontró el monto de ${currency} (div #${id}) en la página del BCV`,
      );
    }

    const amount = this.parseVeAmount(match[1]);
    if (amount === null) {
      throw new ServiceUnavailableException(
        `El monto de ${currency} en el BCV no es un número válido: "${match[1].trim()}"`,
      );
    }
    return amount;
  }

  /**
   * `"423,4562772"` → `423.45`. El BCV usa formato venezolano: punto como
   * separador de miles y coma como decimal.
   *
   * Los decimales sobrantes se **TRUNCAN, no se redondean**: la tasa se registra
   * como `423,45`, nunca como `423,46` (`exchange_rates.amountBs` es
   * `numeric(14,2)`).
   *
   * El recorte se hace sobre el STRING, antes de convertir a número: en `float`
   * `Math.trunc(v * 100) / 100` falla con valores como `8.29`
   * (`8.29 * 100 === 828.9999999999999` → `8.28`).
   */
  private parseVeAmount(raw: string): number | null {
    const cleaned = raw
      .replace(/[\s ]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const dot = cleaned.indexOf('.');
    const truncated = dot === -1 ? cleaned : cleaned.slice(0, dot + 3);
    const value = Number(truncated);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }

  /**
   * `Fecha Valor` como ISO con offset de Venezuela. Prefiere el atributo
   * `content` (RDFa, ya viene en ISO); si no está, parsea el texto en español.
   */
  private extractEffectiveDate(html: string): string {
    const classes = BCV_DATE_CONTAINER_CLASSES.map((c) => `[^"]*${c}`).join('');
    const fromContent = new RegExp(
      `class="${classes}[^"]*"[\\s\\S]{0,500}?content="([^"]+)"`,
      'i',
    ).exec(html);

    if (fromContent) {
      const parsed = new Date(fromContent[1]);
      if (!Number.isNaN(parsed.getTime())) return fromContent[1];
      this.logger.warn(`El atributo content del BCV no es una fecha válida: ${fromContent[1]}`);
    }

    const fromText = /Fecha\s*Valor:\s*(?:<[^>]*>\s*)*([^<]+)/i.exec(html);
    if (fromText) {
      const iso = this.parseSpanishDate(fromText[1]);
      if (iso) return iso;
      this.logger.warn(`No se pudo interpretar la fecha del BCV: "${fromText[1].trim()}"`);
    }

    throw new ServiceUnavailableException(
      'No se encontró la "Fecha Valor" en la página del BCV',
    );
  }

  /** `"Lunes, 17 Agosto  2026"` → `"2026-08-17T00:00:00-04:00"`. */
  private parseSpanishDate(text: string): string | null {
    const match = /(\d{1,2})\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+(\d{4})/.exec(text);
    if (!match) return null;

    const day = Number(match[1]);
    const month = SPANISH_MONTHS[this.stripAccents(match[2]).toLowerCase()];
    const year = Number(match[3]);
    if (!month || day < 1 || day > 31) return null;

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}T00:00:00${VE_UTC_OFFSET}`;
  }

  private stripAccents(value: string): string {
    return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
