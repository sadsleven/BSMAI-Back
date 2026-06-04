import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, LogLevel, INestApplication } from '@nestjs/common';
import express, { Express, Request, Response } from 'express';
import { AppModule } from './app.module';
import { getCorsOriginConfig } from './shared/utils/cors-origins.util';

let cachedApp: INestApplication | null = null;
let cachedServer: Express | null = null;

async function bootstrap(): Promise<{ app: INestApplication; server: Express }> {
  if (cachedApp && cachedServer) {
    return { app: cachedApp, server: cachedServer };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const logLevels: LogLevel[] = isProduction
    ? ['error', 'warn']
    : ['log', 'debug', 'error', 'warn', 'verbose'];

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
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

  await app.init();

  cachedApp = app;
  cachedServer = expressApp;
  return { app, server: expressApp };
}

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

if (!isServerless) {
  bootstrap().then(async ({ app }) => {
    await app.listen(process.env.PORT ?? 3000);
  });
}

export default async function handler(req: Request, res: Response) {
  const { server } = await bootstrap();
  return server(req, res);
}
