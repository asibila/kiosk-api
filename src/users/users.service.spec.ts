import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { verifyPassword } from './password.js';
import { UsersService } from './users.service.js';

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: 'test',
  });
}

function createPrismaMock() {
  return {
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

const user = {
  id: 1,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'USER',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UsersService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('hashes the password instead of storing it', async () => {
      prisma.user.create.mockResolvedValue(user);

      await service.create({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'super-secret',
      });

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data.passwordHash).not.toBe('super-secret');
      await expect(
        verifyPassword('super-secret', data.passwordHash),
      ).resolves.toBe(true);
    });

    it('never selects the password hash', async () => {
      prisma.user.create.mockResolvedValue(user);

      await service.create({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'super-secret',
      });

      const { select } = prisma.user.create.mock.calls[0][0];
      expect(select.passwordHash).toBeUndefined();
    });

    it('reports a duplicate email as a conflict', async () => {
      prisma.user.create.mockRejectedValue(knownError('P2002'));

      await expect(
        service.create({
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          password: 'super-secret',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns users without password hashes', async () => {
      prisma.user.findMany.mockResolvedValue([user]);

      await expect(service.findAll()).resolves.toEqual([user]);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({ id: true, email: true }),
        orderBy: { id: 'asc' },
      });
      expect(
        prisma.user.findMany.mock.calls[0][0].select.passwordHash,
      ).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('returns the user when it exists', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.findOne(1)).resolves.toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.any(Object),
      });
    });

    it('throws 404 when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('hashes a new password', async () => {
      prisma.user.update.mockResolvedValue(user);

      await service.update(1, { password: 'another-secret' });

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data.passwordHash).not.toBe('another-secret');
      await expect(
        verifyPassword('another-secret', data.passwordHash),
      ).resolves.toBe(true);
    });

    it('leaves the password hash alone when no password is given', async () => {
      prisma.user.update.mockResolvedValue(user);

      await service.update(1, { name: 'Ada King' });

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data).toEqual({ name: 'Ada King' });
      expect(data.passwordHash).toBeUndefined();
    });

    it('throws 404 when the user does not exist', async () => {
      prisma.user.update.mockRejectedValue(knownError('P2025'));

      await expect(
        service.update(404, { name: 'Ada King' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the user', async () => {
      prisma.user.delete.mockResolvedValue(user);

      await service.remove(1);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws 404 when the user does not exist', async () => {
      prisma.user.delete.mockRejectedValue(knownError('P2025'));

      await expect(service.remove(404)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
