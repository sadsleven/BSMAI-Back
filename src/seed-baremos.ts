import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BaremosSeedService } from './seed/baremos/baremos-seed.service';

/**
 * Entrada CLI del seeder de baremos (separado del seed principal).
 * Uso: `npm run seed:baremos`.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    await app.get(BaremosSeedService).run();
  } finally {
    await app.close();
  }
}

bootstrap();
