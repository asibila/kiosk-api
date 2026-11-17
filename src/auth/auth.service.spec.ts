import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { hashPassword } from '../users/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const user = {
  id: 7,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'USER',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AuthService', () => {
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    session: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: vi.fn() },
      session: {
        create: vi.fn(async ({ data }) => data),
        findUnique: vi.fn(),
        delete: vi.fn(async () => ({})),
        deleteMany: vi.fn(),
      },
    };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  it('returns the signed-in user when the credentials are valid', async () => {
    const hash = await hashPassword('super-secret');
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash: hash });

    await expect(
      service.login('ada@example.com', 'super-secret'),
    ).resolves.toEqual(user);
  });

  it('looks the user up by email (already lowercased by the login DTO)', async () => {
    const hash = await hashPassword('super-secret');
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash: hash });

    await service.login('ada@example.com', 'super-secret');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' },
      select: expect.objectContaining({
        id: true,
        email: true,
        passwordHash: true,
      }),
    });
  });

  it('throws Unauthorized when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('nobody@example.com', 'super-secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized when the password does not match', async () => {
    const hash = await hashPassword('super-secret');
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash: hash });

    await expect(service.login('ada@example.com', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws Unauthorized for a deactivated account, even with the right password', async () => {
    const hash = await hashPassword('super-secret');
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: hash,
      isActive: false,
    });

    await expect(service.login('ada@example.com', 'super-secret')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('stores only a hash of the session token and resolves it back to the user', async () => {
    const { token } = await service.createSession(7, 'vitest');

    const stored = prisma.session.create.mock.calls[0][0].data;
    expect(stored.userId).toBe(7);
    expect(stored.id).not.toBe(token);
    expect(stored.id).toMatch(/^[0-9a-f]{64}$/);

    prisma.session.findUnique.mockResolvedValue({
      id: stored.id,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });

    await expect(service.resolveSession(token)).resolves.toEqual(user);
  });

  it('rejects an expired session and removes the row', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'expired',
      expiresAt: new Date(Date.now() - 60_000),
      user,
    });

    await expect(service.resolveSession('token')).resolves.toBeNull();
    expect(prisma.session.delete).toHaveBeenCalled();
  });
});
