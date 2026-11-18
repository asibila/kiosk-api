import type { CookieOptions } from 'express';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Name of the HTTP-only session cookie. */
export const SESSION_COOKIE =
  process.env.SESSION_COOKIE_NAME?.trim() || 'kiosk_session';

/** Session lifetime; `SESSION_TTL_DAYS` overrides the seven-day default. */
export function sessionTtlMs(): number {
  const days = Number(process.env.SESSION_TTL_DAYS);
  return Number.isFinite(days) && days > 0 ? days * DAY_MS : 7 * DAY_MS;
}

/** True when the API runs on a deployed HTTPS origin (Render or NODE_ENV). */
export function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.RENDER_SERVICE_ID)
  );
}

/**
 * Cookie flags. The deployed frontend and API are different origins, so
 * production defaults to `SameSite=None` (needed for cross-site `fetch`
 * credentials); local dev uses `Lax` through the Vite proxy. Deployments that
 * serve the API under the frontend origin can set `SESSION_COOKIE_SAMESITE=lax`.
 */
export function sessionCookieOptions(maxAge: number): CookieOptions {
  const configured = process.env.SESSION_COOKIE_SAMESITE?.trim().toLowerCase();
  const production = isProductionRuntime();
  const sameSite =
    configured === 'strict' || configured === 'lax' || configured === 'none'
      ? configured
      : production
        ? 'none'
        : 'lax';

  return {
    httpOnly: true,
    secure: production || sameSite === 'none',
    sameSite,
    path: '/',
    maxAge,
  };
}

/** Token held by the session cookie, or `null` when the cookie is absent. */
export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE) continue;

    const value = decodeURIComponent(part.slice(separator + 1).trim());
    return value || null;
  }

  return null;
}
