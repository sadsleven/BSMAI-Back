import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

/**
 * Levanta una INestApplication con la misma configuración que `main.ts`
 * (ValidationPipe global con whitelist + transform). Reutilizable en todos
 * los e2e specs para evitar duplicar boilerplate.
 *
 * Llamar `await closeApp(app)` en `afterAll` para cerrar conexiones DB y
 * evitar leaks entre suites.
 */
export async function bootstrapApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({
    logger: ['error', 'warn'],
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
  return app;
}

export async function closeApp(
  app: INestApplication | undefined,
): Promise<void> {
  if (!app) return;
  await app.close();
}
