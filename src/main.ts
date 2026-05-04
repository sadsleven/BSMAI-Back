import { NestFactory } from '@nestjs/core';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import type { Express } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<Express | void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = isProduction
    ? ['error', 'warn']
    : ['log', 'debug', 'error', 'warn', 'verbose'];

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: logLevels,
  });

  app.enableShutdownHooks();

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials:
      process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*' ? true : false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.VERCEL) {
    await app.init();
    return app.getHttpAdapter().getInstance();
  }

  await app.listen(process.env.PORT ?? 3000);
}

export default bootstrap();
