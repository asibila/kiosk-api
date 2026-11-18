import type { CookieOptions } from 'express';
import { isProductionRuntime } from '../session-cookie.js';

/** Short-lived cookie that carries the OAuth `state` and the page to return to. */
export const OAUTH_STATE_COOKIE = 'kiosk_oauth_state';

/** Ten minutes is plenty for the consent screen. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthState = {
  state: string;
  from: string;
  /** Set when the flow was started from the profile to link a provider. */
  link?: boolean;
  userId?: number;
};

function encode(value: OAuthState): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode(raw: string): OAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      state?: unknown;
      from?: unknown;
      link?: unknown;
      userId?: unknown;
    };
    if (typeof parsed.state !== 'string' || typeof parsed.from !== 'string') return null;
    return {
      state: parsed.state,
      from: parsed.from,
      link: parsed.link === true,
      userId: typeof parsed.userId === 'number' ? parsed.userId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Only local paths are accepted as a return target, so the redirect can never
 * leave the site (no `//host` protocol-relative tricks).
 */
export function safeReturnPath(value: unknown): string {
  const path = typeof value === 'string' ? value.trim() : '';
  if (!path.startsWith('/') || path.startsWith('//')) return '/search';
  return path;
}

export function readOAuthState(cookieHeader: string | undefined): OAuthState | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== OAUTH_STATE_COOKIE) continue;
    return decode(decodeURIComponent(part.slice(separator + 1).trim()));
  }

  return null;
}

/**
 * The state cookie is only sent to `/auth/google`. `SameSite=Lax` is enough
 * because both hops are top-level navigations (site → API, Google → API).
 */
export function oauthStateCookieOptions(): CookieOptions {
  const production = isProductionRuntime();

  return {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/auth/google',
    maxAge: OAUTH_STATE_TTL_MS,
  };
}

export function encodeOAuthState(value: OAuthState): string {
  return encode(value);
}
