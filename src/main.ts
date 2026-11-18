import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';

// The deployed frontend is a separate origin from the API, so the browser needs
// CORS. `FRONTEND_ORIGINS` is a comma-separated list that replaces the defaults
// when the frontend moves to a custom domain.
const DEFAULT_FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:4173',
  'https://localhost:4173',
  // Legacy static site (kept while the SSR web service is verified).
  'https://kiosk-9j6p.onrender.com',
  // SSR web service (`node server.js`).
  'https://kiosk-ssr.onrender.com',
];

const frontendOrigins = (process.env.FRONTEND_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: frontendOrigins.length ? frontendOrigins : DEFAULT_FRONTEND_ORIGINS,
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

    const allowed = new Set(
      frontendOrigins.length ? frontendOrigins : DEFAULT_FRONTEND_ORIGINS,
    );
    const self = `${request.protocol}://${request.get('host')}`;
    if (allowed.has(origin) || origin === self) {
      next();
      return;
    }

    response.status(403).json({ message: 'Origin not allowed' });
  });

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
