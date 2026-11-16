import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// The deployed frontend is a separate origin from the API, so the browser needs
// CORS. `FRONTEND_ORIGINS` is a comma-separated list that replaces the defaults
// when the frontend moves to a custom domain.
const DEFAULT_FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:4173',
  'https://localhost:4173',
  'https://kiosk-9j6p.onrender.com',
];

const frontendOrigins = (process.env.FRONTEND_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: frontendOrigins.length ? frontendOrigins : DEFAULT_FRONTEND_ORIGINS,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // `x-actor-id` is the app's actor header; content-type is needed for JSON
    // writes and multipart image uploads.
    allowedHeaders: ['content-type', 'x-actor-id'],
  });
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
