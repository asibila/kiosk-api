import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ensureAdmin } from './bootstrap/admin-bootstrap.js';
import { DEFAULT_FRONTEND_ORIGINS, frontendOrigins } from './common/frontend-origins.js';
import { PrismaService } from './prisma/prisma.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configured browsers (`FRONTEND_ORIGINS`) or the deployed defaults.
  const allowedOrigins = frontendOrigins();

  // Render terminates TLS in front of the service: trust its forwarded headers
  // so `request.ip` (rate limiting) and `request.protocol` see the visitor.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      // The API answers JSON and image bytes, never HTML pages; the SSR server
      // ships the CSP that matters for the site.
      contentSecurityPolicy: false,
      // Listing images are embedded by the frontend origin (a different origin).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // `x-actor-id` is kept for old cached bundles; the API now uses the session.
    allowedHeaders: ['content-type', 'x-actor-id'],
  });

  // Cookie-authenticated writes get a second line of defence against CSRF:
  // browsers send an Origin header, and only the configured frontends may post.
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }

    const origin = request.headers.origin;
    if (!origin) {
      next();
      return;
    }

    const allowed = new Set(allowedOrigins);
    const self = `${request.protocol}://${request.get('host')}`;
    if (allowed.has(origin) || origin === self) {
      next();
      return;
    }

    response.status(403).json({ message: 'Origin not allowed' });
  });

  // Promote or create the owner account (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
  await ensureAdmin(app.get(PrismaService), new Logger('admin-bootstrap'));

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
