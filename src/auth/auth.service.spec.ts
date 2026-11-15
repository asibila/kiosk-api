import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { hashPassword } from '../users/password.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let prisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: vi.fn() } };
    service = new AuthService(prisma as unknown as PrismaService);
  });

  it('returns the user id when the credentials are valid', async () => {
    const hash = await hashPassword('super-secret');
    prisma.user.findUnique.mockResolvedValue({ id: 7, passwordHash: hash });

    await expect(service.login('ada@example.com', 'super-secret')).resolves.toEqual({
      userId: 7,
    });
  });

  it('looks the user up by email (already lowercased by the login DTO)', async () => {
    const hash = await hashPassword('super-secret');
    prisma.user.findUnique.mockResolvedValue({ id: 7, passwordHash: hash });

    await service.login('ada@example.com', 'super-secret');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' },
      select: { id: true, passwordHash: true },
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
    prisma.user.findUnique.mockResolvedValue({ id: 7, passwordHash: hash });

    await expect(service.login('ada@example.com', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
