import 'reflect-metadata';
import { startupErrorMessage, validateStartupEnvironment } from './common/environment';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './openapi/setup';
import { DatabaseErrorFilter } from './common/errors';
async function bootstrap() {
  validateStartupEnvironment();
  const app = await NestFactory.create(AppModule, { rawBody: true, abortOnError: false });
  app.setGlobalPrefix('api/v1');
  app.use(
    (_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  app.useGlobalFilters(new DatabaseErrorFilter());
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
  if (origins.length) app.enableCors({ origin: origins, credentials: false });
  setupSwagger(app);
  app.enableShutdownHooks();
  try {
    await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1');
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}
bootstrap().catch((error: unknown) => {
  console.error(`API startup failed: ${startupErrorMessage(error)}`);
  process.exitCode = 1;
});
