import type { CookieOptions } from 'express';
import { isProductionRuntime } from '../auth/session-cookie.js';

/** Cookie holding the anonymous visitor id used to dedupe views. */
export const VISITOR_COOKIE =
  process.env.VISITOR_COOKIE_NAME?.trim() || 'kiosk_visitor';

/** One year, in milliseconds. */
export const VISITOR_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/** Visitor ids are 128 random bits, hex encoded. Anything else is ignored. */
const VISITOR_ID = /^[a-f0-9]{32}$/;

/** Read the visitor id from a `Cookie` header, or `null`. */
export function readVisitorId(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== VISITOR_COOKIE) continue;
    const value = decodeURIComponent(part.slice(separator + 1).trim());
    return VISITOR_ID.test(value) ? value : null;
  }

  return null;
}

/** True for a value this API generated (used to validate incoming ids). */
export function isVisitorId(value: string | null | undefined): boolean {
  return typeof value === 'string' && VISITOR_ID.test(value);
}

/**
 * Cookie flags for the visitor id. Same rules as the session cookie: deployed
 * HTTPS origins use `SameSite=None` because the frontend is a different origin
 * from the API; local dev keeps `Lax`.
 */
export function visitorCookieOptions(): CookieOptions {
  const production = isProductionRuntime();

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/',
    maxAge: VISITOR_TTL_MS,
  };
}
