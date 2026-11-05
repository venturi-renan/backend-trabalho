import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './common/api-docs';
import { loadEnv } from './config/env';

async function bootstrap() {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.enableShutdownHooks();
  setupSwagger(app);

  await app.listen(env.PORT);
}

bootstrap();
