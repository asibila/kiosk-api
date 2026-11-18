import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { UsersService } from '../../users/users.service.js';
import { GoogleAuthService, type GoogleProfile } from './google-auth.service.js';

const profile: GoogleProfile = {
  sub: 'google-sub-1',
  email: 'pero@example.com',
  emailVerified: true,
  name: 'Pero Perić',
};

const existingUser = {
  id: 7,
  name: 'Pero',
  email: 'pero@example.com',
  role: 'USER',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createService({
  linked = null as null | { user: typeof existingUser },
  existing = null as null | (typeof existingUser & { passwordHash: string | null }),
  createSocial = vi.fn(async () => existingUser),
} = {}) {
  const config = {
    get: (key: string) =>
      ({ GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret' })[key],
  } as unknown as ConfigService;

  const prisma = {
    oAuthAccount: {
      findUnique: vi.fn(async () => linked),
      create: vi.fn(async () => ({ id: 1 })),
    },
    user: { findUnique: vi.fn(async () => existing) },
  };

  const service = new GoogleAuthService(
    config,
    prisma as unknown as PrismaService,
    { createSocial } as unknown as UsersService,
  );

  return { service, prisma, createSocial };
}

describe('GoogleAuthService', () => {
  it('builds the consent URL with the expected parameters', () => {
    const { service } = createService();

    const url = new URL(
      service.authorizationUrl('state-123', 'https://api.test/auth/google/callback'),
    );

    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.test/auth/google/callback',
    );
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('does not start without credentials', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const service = new GoogleAuthService(
      config,
      {} as PrismaService,
      { createSocial: vi.fn() } as unknown as UsersService,
    );

    expect(service.isConfigured()).toBe(false);
    expect(() => service.authorizationUrl('s', 'https://api.test/cb')).toThrow(
      /not configured/,
    );
  });

  it('exchanges the code and normalizes the profile', async () => {
    const { service } = createService();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-sub-1',
          email: ' Pero@Example.com ',
          email_verified: true,
          name: 'Pero Perić',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      service.exchangeCode('code-1', 'https://api.test/auth/google/callback'),
    ).resolves.toEqual({
      sub: 'google-sub-1',
      email: 'pero@example.com',
      emailVerified: true,
      name: 'Pero Perić',
    });

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(String(tokenInit.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBe('client-secret');

    vi.unstubAllGlobals();
  });

  it('returns null when the token endpoint rejects the code', async () => {
    const { service } = createService();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400 })));

    await expect(service.exchangeCode('bad', 'https://api.test/cb')).resolves.toBeNull();

    vi.unstubAllGlobals();
  });

  it('signs in through an existing link', async () => {
    const { service, prisma, createSocial } = createService({
      linked: { user: existingUser },
    });

    await expect(service.signIn(profile)).resolves.toEqual({
      status: 'signed-in',
      user: existingUser,
    });
    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    expect(createSocial).not.toHaveBeenCalled();
  });

  it('refuses an email that belongs to a password account', async () => {
    const { service, prisma, createSocial } = createService({
      existing: { ...existingUser, passwordHash: 'scrypt:abc:def' },
    });

    await expect(service.signIn(profile)).resolves.toEqual({ status: 'email-in-use' });
    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    expect(createSocial).not.toHaveBeenCalled();
  });

  it('links an email that only has a provider account', async () => {
    const { service, prisma } = createService({
      existing: { ...existingUser, passwordHash: null },
    });

    await expect(service.signIn(profile)).resolves.toMatchObject({ status: 'signed-in' });
    expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        userId: existingUser.id,
        provider: 'google',
        providerAccountId: profile.sub,
        email: profile.email,
      },
    });
  });

  it('creates an account for a new email', async () => {
    const { service, prisma, createSocial } = createService();

    await expect(service.signIn(profile)).resolves.toMatchObject({ status: 'signed-in' });
    expect(createSocial).toHaveBeenCalledWith({
      name: 'Pero Perić',
      email: 'pero@example.com',
    });
    expect(prisma.oAuthAccount.create).toHaveBeenCalledOnce();
  });

  it('falls back to the email local part for a missing name', async () => {
    const { service, createSocial } = createService();

    await service.signIn({ ...profile, name: null });

    expect(createSocial).toHaveBeenCalledWith({
      name: 'pero',
      email: 'pero@example.com',
    });
  });

  it('refuses inactive accounts', async () => {
    const { service, prisma } = createService({
      linked: { user: { ...existingUser, isActive: false } },
    });

    await expect(service.signIn(profile)).resolves.toEqual({ status: 'inactive' });
    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
  });

  it('refuses a profile whose email is not verified by Google', async () => {
    const { service } = createService();

    await expect(service.signIn({ ...profile, emailVerified: false })).resolves.toEqual({
      status: 'email-unverified',
    });
  });

  it('tolerates losing the link race with a concurrent callback', async () => {
    const { service, prisma } = createService({
      existing: { ...existingUser, passwordHash: null },
    });
    prisma.oAuthAccount.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.signIn(profile)).resolves.toMatchObject({ status: 'signed-in' });
  });
});
