import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthService } from '../auth.service.js';
import { encodeOAuthState, OAUTH_STATE_COOKIE } from './oauth-state.js';
import { GoogleAuthController } from './google-auth.controller.js';
import { GoogleAuthService } from './google-auth.service.js';

const USER = {
  id: 7,
  name: 'Ana',
  email: 'ana@example.com',
  role: 'USER',
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const PROFILE = {
  sub: 'google-sub-1',
  email: 'ana@example.com',
  email_verified: true,
  name: 'Ana',
};

/** A signed-in browser request carrying the OAuth state cookie. */
function requestWithState(state: string, extra: { link?: boolean; userId?: number } = {}) {
  const payload = encodeOAuthState({
    state,
    from: '/app',
    link: true,
    userId: USER.id,
    ...extra,
  });

  return {
    headers: {
      cookie: `kiosk_session=session-token; ${OAUTH_STATE_COOKIE}=${payload}`,
      'user-agent': 'vitest',
    },
    protocol: 'https',
    get: () => 'api.example.com',
  } as unknown as Request;
}

function responseSpy() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    redirect: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;
}

function createController({
  linkedUserId = USER.id,
  oauthRow = null as null | { userId: number },
  ownRow = null as null | { providerAccountId: string },
} = {}) {
  const prisma = {
    oAuthAccount: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if ('provider_providerAccountId' in where) return oauthRow;
        return ownRow;
      }),
      create: vi.fn(async ({ data }: { data: { userId: number } }) => ({
        id: 1,
        ...data,
      })),
      count: vi.fn(async () => (oauthRow || ownRow ? 1 : 0)),
    },
    user: { findUnique: vi.fn(async () => null) },
  };

  const config = {
    get: (key: string) =>
      ({
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
      })[key],
  } as unknown as ConfigService;

  const service = new GoogleAuthService(
    config,
    prisma as never,
    { createSocial: vi.fn() } as never,
  );

  const auth = {
    createSession: vi.fn(async () => ({ token: 'new-session' })),
  } as unknown as AuthService;

  return {
    controller: new GoogleAuthController(service, auth),
    prisma,
    linkedUserId,
  };
}

function stubGoogle() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(PROFILE), { status: 200 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GoogleAuthController link flow', () => {
  it('starts the link flow for the signed-in account', () => {
    vi.stubEnv('PUBLIC_ORIGIN', 'https://site.test');
    const { controller } = createController();
    const request = requestWithState('state-1');
    const response = responseSpy();

    controller.start('/app', '1', USER, request, response);

    const [, payload] = (response.cookie as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const decoded = JSON.parse(
      Buffer.from(String(payload), 'base64url').toString('utf8'),
    );
    expect(decoded).toMatchObject({ link: true, userId: USER.id, from: '/app' });
    expect((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
      'accounts.google.com',
    );
  });

  it('links the Google identity and returns to /app with the result', async () => {
    vi.stubEnv('PUBLIC_ORIGIN', 'https://site.test');
    stubGoogle();
    const { controller, prisma } = createController();
    const request = requestWithState('state-2');
    const response = responseSpy();

    await controller.callback('code', 'state-2', undefined, USER, request, response);

    expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        userId: USER.id,
        provider: 'google',
        providerAccountId: PROFILE.sub,
        email: PROFILE.email,
      },
    });
    expect((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://site.test/app?google=connected',
    );
  });

  it('is a no-op when the identity is already linked to this account', async () => {
    vi.stubEnv('PUBLIC_ORIGIN', 'https://site.test');
    stubGoogle();
    const { controller, prisma } = createController({
      oauthRow: { userId: USER.id },
    });
    const response = responseSpy();

    await controller.callback(
      'code',
      'state-3',
      undefined,
      USER,
      requestWithState('state-3'),
      response,
    );

    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    expect((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://site.test/app?google=connected',
    );
  });

  it('refuses a Google identity linked to another user', async () => {
    vi.stubEnv('PUBLIC_ORIGIN', 'https://site.test');
    stubGoogle();
    const { controller } = createController({ oauthRow: { userId: 999 } });
    const response = responseSpy();

    await controller.callback(
      'code',
      'state-4',
      undefined,
      USER,
      requestWithState('state-4'),
      response,
    );

    expect((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://site.test/app?google=error_google_taken',
    );
  });

  it('refuses when the signed-in account changed during the flow', async () => {
    vi.stubEnv('PUBLIC_ORIGIN', 'https://site.test');
    stubGoogle();
    const { controller } = createController();
    const response = responseSpy();

    await controller.callback(
      'code',
      'state-5',
      undefined,
      { ...USER, id: 999 },
      requestWithState('state-5'),
      response,
    );

    expect((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://site.test/app?google=error_link_failed',
    );
  });

  it('refuses a Google account with a different email', async () => {
    vi.stubEnv('PUBLIC_ORIGIN', 'https://site.test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/token')
          ? new Response(JSON.stringify({ access_token: 'access-token' }), { status: 200 })
          : new Response(
              JSON.stringify({ ...PROFILE, email: 'other@example.com' }),
              { status: 200 },
            ),
      ),
    );
    const { controller, prisma } = createController();
    const response = responseSpy();

    await controller.callback(
      'code',
      'state-6',
      undefined,
      USER,
      requestWithState('state-6'),
      response,
    );

    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    expect((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://site.test/app?google=error_email_mismatch',
    );
  });

  it('rejects a callback whose state does not match the cookie', async () => {
    vi.stubEnv('PUBLIC_ORIGIN', 'https://site.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { controller } = createController();
    const response = responseSpy();

    await controller.callback(
      'code',
      'tampered-state',
      undefined,
      USER,
      requestWithState('state-7'),
      response,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://site.test/app?google=error_failed',
    );
  });

  it('reports a denied consent screen without calling Google', async () => {
    vi.stubEnv('PUBLIC_ORIGIN', 'https://site.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { controller } = createController();
    const response = responseSpy();

    await controller.callback(
      undefined,
      'state-8',
      'access_denied',
      USER,
      requestWithState('state-8'),
      response,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect((response.redirect as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      'https://site.test/app?google=error_denied',
    );
  });
});
