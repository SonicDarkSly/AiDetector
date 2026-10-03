import 'reflect-metadata';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import { AppModule } from './app.module.js';
import { loadEnv } from './shared/config/env.js';
import { SERVER_ROOT } from './shared/config/paths.js';
import { accessLog } from './shared/http/access-log.js';
import { FileTeeLogger } from './shared/logging/file-tee.logger.js';

async function bootstrap(): Promise<void> {
  loadEnv(join(SERVER_ROOT, '.env'));
  const port = Number(process.env.PORT ?? 3002);

  const logDir = join(SERVER_ROOT, 'logs');
  mkdirSync(logDir, { recursive: true });
  const logger = new FileTeeLogger(createWriteStream(join(logDir, 'access.log'), { flags: 'a' }));

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
  app.enableCors();
  app.use(json({ limit: '4mb' }));
  app.set('etag', false);
  app.use(accessLog());
  await app.listen(port);

  const config = new Logger('Config');
  config.log(`Serveur démarré sur http://localhost:${port}`);
  config.log('Détecteurs : métadonnées, artefacts, caractères cachés, code, style, statistiques');
}

void bootstrap();
