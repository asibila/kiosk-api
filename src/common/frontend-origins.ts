// Browser origins that may call the API. `FRONTEND_ORIGINS` (comma-separated)
// replaces the defaults; the first HTTPS entry is also the site the OAuth flow
// returns to when `PUBLIC_ORIGIN` is not configured.

/** Deployed sites first, local dev last. */
export const DEFAULT_FRONTEND_ORIGINS = [
  'https://kiosk-ssr.onrender.com',
  'https://kiosk-9j6p.onrender.com',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://localhost:4173',
  'https://localhost:4173',
];

const trimOrigin = (value: string): string => value.trim().replace(/\/+$/, '');

/** Configured origins, or the defaults when `FRONTEND_ORIGINS` is empty. */
export function frontendOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.FRONTEND_ORIGINS ?? '')
    .split(',')
    .map(trimOrigin)
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_FRONTEND_ORIGINS;
}

/**
 * Where the browser returns after sign-in / where messages link to.
 * `PUBLIC_ORIGIN` wins; otherwise the first deployed (HTTPS, non-localhost)
 * origin; otherwise the first configured one.
 */
export function primaryFrontendOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = (env.PUBLIC_ORIGIN ?? '').trim();
  if (configured) return trimOrigin(configured);

  const origins = frontendOrigins(env);
  const deployed = origins.find(
    (origin) => origin.startsWith('https://') && !origin.includes('localhost'),
  );

  return trimOrigin(deployed ?? origins[0] ?? 'http://localhost:5173');
}
