import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../public.decorator.js';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlMs,
} from '../session-cookie.js';
import { AuthService } from '../auth.service.js';
import { GoogleAuthService } from './google-auth.service.js';
import {
  encodeOAuthState,
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
  readOAuthState,
  safeReturnPath,
} from './oauth-state.js';

/** Where the browser goes after sign-in. */
function frontendOrigin(): string {
  const configured = process.env.PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const first = process.env.FRONTEND_ORIGINS?.split(',')[0]?.trim();
  if (first) return first.replace(/\/+$/, '');

  return 'http://localhost:5173';
}

/** Callback URL registered in the Google Cloud console. */
function redirectUri(request: Request): string {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${request.protocol}://${request.get('host')}/auth/google/callback`;
}

function userAgent(request: Request): string | null {
  const value = request.headers['user-agent'];
  const text = Array.isArray(value) ? value[0] : value;
  return text ?? null;
}

/**
 * `GET /auth/google` starts the flow; `GET /auth/google/callback` finishes it.
 * Both are top-level navigations from the browser, so they answer with
 * redirects rather than JSON.
 *
 * The callback always redirects to the site with `?error=<code>` on failure;
 * the login screen turns that into a message.
 */
@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  start(
    @Query('from') from: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): void {
    const target = safeReturnPath(from);

    if (!this.googleAuthService.isConfigured()) {
      response.redirect(`${frontendOrigin()}/login?error=unavailable`);
      return;
    }

    const state = this.googleAuthService.newState();
    response.cookie(
      OAUTH_STATE_COOKIE,
      encodeOAuthState({ state, from: target }),
      oauthStateCookieOptions(),
    );
    response.redirect(
      this.googleAuthService.authorizationUrl(state, redirectUri(request)),
    );
  }

  @Public()
  @Get('callback')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const stored = readOAuthState(request.headers.cookie);
    const target = stored?.from ?? '/search';
    response.clearCookie(OAUTH_STATE_COOKIE, { path: '/auth/google' });

    if (error) {
      // `access_denied` means the visitor pressed Cancel on the consent screen.
      this.fail(response, target, error === 'access_denied' ? 'denied' : 'failed');
      return;
    }

    if (!stored || !state || stored.state !== state || !code) {
      this.fail(response, target, 'failed');
      return;
    }

    const profile = await this.googleAuthService.exchangeCode(
      code,
      redirectUri(request),
    );
    if (!profile) {
      this.fail(response, target, 'failed');
      return;
    }

    const result = await this.googleAuthService.signIn(profile);
    if (result.status !== 'signed-in') {
      const code =
        result.status === 'email-in-use'
          ? 'email_in_use'
          : result.status === 'inactive'
            ? 'account_inactive'
            : 'email_unverified';
      this.fail(response, target, code);
      return;
    }

    const { token } = await this.authService.createSession(
      result.user.id,
      userAgent(request),
    );
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions(sessionTtlMs()));
    response.redirect(`${frontendOrigin()}${target}`);
  }

  private fail(response: Response, target: string, code: string): void {
    const separator = target.includes('?') ? '&' : '?';
    response.redirect(
      `${frontendOrigin()}/login?error=${encodeURIComponent(code)}&from=${encodeURIComponent(target)}`,
    );
  }
}
