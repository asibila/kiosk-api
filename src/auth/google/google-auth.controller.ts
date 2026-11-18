import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { primaryFrontendOrigin } from '../../common/frontend-origins.js';
import { CurrentUser, type RequestUser } from '../current-user.decorator.js';
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

/** Where the browser goes after sign-in (`PUBLIC_ORIGIN` or the deployed default). */
function frontendOrigin(): string {
  return primaryFrontendOrigin();
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
 * `?link=1` (started from the profile) attaches the Google identity to the
 * signed-in account instead of signing in. Failures redirect to the site with
 * `?google=error_<code>`; the login screen uses `?error=<code>`.
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
    @Query('link') link: string | undefined,
    @CurrentUser() user: RequestUser | null,
    @Req() request: Request,
    @Res() response: Response,
  ): void {
    const target = safeReturnPath(from);
    const linking = link === '1';

    // Linking needs a session; without one the browser goes to the login page.
    if (linking && !user) {
      response.redirect(
        `${frontendOrigin()}/login?error=link_failed&from=${encodeURIComponent(target)}`,
      );
      return;
    }

    if (!this.googleAuthService.isConfigured()) {
      response.redirect(
        `${frontendOrigin()}/login?error=unavailable&from=${encodeURIComponent(target)}`,
      );
      return;
    }

    const state = this.googleAuthService.newState();
    response.cookie(
      OAUTH_STATE_COOKIE,
      encodeOAuthState({
        state,
        from: target,
        ...(linking && user ? { link: true, userId: user.id } : {}),
      }),
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
    @CurrentUser() user: RequestUser | null,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const stored = readOAuthState(request.headers.cookie);
    const target = stored?.from ?? '/search';
    response.clearCookie(OAUTH_STATE_COOKIE, { path: '/auth/google' });

    // --- Profile flow: attach Google to the account already signed in --------
    if (stored?.link) {
      const sessionMatches = user != null && user.id === stored.userId;

      if (error || !sessionMatches || !state || stored.state !== state || !code) {
        this.finishLink(
          response,
          target,
          sessionMatches ? (error ? 'error_denied' : 'error_failed') : 'error_link_failed',
        );
        return;
      }

      const profile = await this.googleAuthService.exchangeCode(
        code,
        redirectUri(request),
      );
      if (!profile) {
        this.finishLink(response, target, 'error_failed');
        return;
      }

      const result = await this.googleAuthService.linkToAccount(user, profile);
      this.finishLink(
        response,
        target,
        result === 'linked' || result === 'already-linked'
          ? 'connected'
          : result === 'email-mismatch'
            ? 'error_email_mismatch'
            : 'error_google_taken',
      );
      return;
    }

    // --- Sign-in flow --------------------------------------------------------
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

  /** Back to the page that started the link, with the outcome in the URL. */
  private finishLink(response: Response, target: string, result: string): void {
    const separator = target.includes('?') ? '&' : '?';
    response.redirect(
      `${frontendOrigin()}${target}${separator}google=${encodeURIComponent(result)}`,
    );
  }

  private fail(response: Response, target: string, code: string): void {
    const separator = target.includes('?') ? '&' : '?';
    response.redirect(
      `${frontendOrigin()}/login?error=${encodeURIComponent(code)}&from=${encodeURIComponent(target)}`,
    );
  }
}
