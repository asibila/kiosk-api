import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from '../users/password.js';
import { ensureAdmin } from './admin-bootstrap.js';

const logger = { log: vi.fn(), warn: vi.fn() } as unknown as Logger;

function createPrisma({
  existing = null as { id: number; role: string } | null,
} = {}) {
  return {
    user: {
      findUnique: vi.fn(async () => existing),
      update: vi.fn(async () => existing),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
  };
}

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
  vi.clearAllMocks();
});

describe('ensureAdmin', () => {
  it('does nothing without ADMIN_EMAIL', async () => {
    delete process.env.ADMIN_EMAIL;
    const prisma = createPrisma();

    await ensureAdmin(prisma as unknown as PrismaService, logger);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('promotes an existing account', async () => {
    process.env.ADMIN_EMAIL = 'owner@example.com';
    const prisma = createPrisma({ existing: { id: 1, role: 'USER' } });

    await ensureAdmin(prisma as unknown as PrismaService, logger);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { role: 'ADMIN', isActive: true },
    });
  });

  it('leaves an existing admin alone', async () => {
    process.env.ADMIN_EMAIL = 'owner@example.com';
    const prisma = createPrisma({ existing: { id: 1, role: 'ADMIN' } });

    await ensureAdmin(prisma as unknown as PrismaService, logger);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('creates the admin when a password is configured', async () => {
    process.env.ADMIN_EMAIL = 'owner@example.com';
    process.env.ADMIN_PASSWORD = 'super-secret';
    process.env.ADMIN_NAME = 'Owner';
    const prisma = createPrisma();

    await ensureAdmin(prisma as unknown as PrismaService, logger);

    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data).toMatchObject({
      name: 'Owner',
      email: 'owner@example.com',
      role: 'ADMIN',
      isActive: true,
    });
    await expect(
      verifyPassword('super-secret', String(data.passwordHash)),
    ).resolves.toBe(true);
  });

  it('warns instead of failing when the password is missing', async () => {
    process.env.ADMIN_EMAIL = 'owner@example.com';
    delete process.env.ADMIN_PASSWORD;
    const prisma = createPrisma();

    await ensureAdmin(prisma as unknown as PrismaService, logger);

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
