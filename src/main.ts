// Primero de todo: el `.env` debe estar en `process.env` antes de que se evalúen
// los módulos — hay constantes leídas al importar (p. ej. MAX_UPLOAD_SIZE_MB en
// `files.constants.ts`, consumida por el decorador de multer). `ConfigModule`
// también carga el `.env`, pero más tarde en el ciclo de vida.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, LogLevel, INestApplication } from '@nestjs/common';
import express, { Express, Request, Response } from 'express';
import { AppModule } from './app.module';
import { getCorsOriginConfig } from './shared/utils/cors-origins.util';
import { isServerlessRuntime } from './shared/utils/runtime.util';

let cachedApp: INestApplication | null = null;
let cachedServer: Express | null = null;

async function bootstrap(): Promise<{
  app: INestApplication;
  server: Express;
}> {
  if (cachedApp && cachedServer) {
    return { app: cachedApp, server: cachedServer };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = isProduction
    ? ['error', 'warn']
    : ['log', 'debug', 'error', 'warn', 'verbose'];

  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    {
      bufferLogs: true,
      logger: logLevels,
    },
  );

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

  await app.init();

  cachedApp = app;
  cachedServer = expressApp;
  return { app, server: expressApp };
}

const isServerless = isServerlessRuntime();

if (!isServerless) {
  bootstrap().then(async ({ app }) => {
    await app.listen(process.env.PORT ?? 3000);
  });
}

export default async function handler(req: Request, res: Response) {
  const { server } = await bootstrap();
  return server(req, res);
}
