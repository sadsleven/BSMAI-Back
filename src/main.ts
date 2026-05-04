import { NestFactory } from '@nestjs/core';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import { AppModule } from './app.module';
import { getCorsOriginConfig } from './shared/utils/cors-origins.util';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = isProduction
    ? ['error', 'warn']
    : ['log', 'debug', 'error', 'warn', 'verbose'];

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: logLevels,
  });

  app.enableShutdownHooks();

  const cors = getCorsOriginConfig();
  app.enableCors({
    origin: cors.origin,
    credentials: cors.credentials,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'If-Match',
      'If-None-Match',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
