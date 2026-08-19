import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BcvRatesSyncService } from './exchange-rates/bcv/bcv-rates-sync.service';

/**
 * Sincronización manual de las tasas del BCV desde la línea de comandos.
 * Mismo patrón que `seed.ts`. Uso:
 *
 *   npm run sync:bcv            # respeta la guarda de "ya se obtuvo hoy"
 *   node dist/sync-bcv.js       # dentro del contenedor (ver `make bcv-sync`)
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  const sync = app.get(BcvRatesSyncService);
  const result = await sync.syncNow(true);
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

bootstrap().catch((error) => {
  console.error('Falló la sincronización con el BCV:', error?.message ?? error);
  process.exit(1);
});
