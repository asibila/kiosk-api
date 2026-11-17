import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/current-user.decorator.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from './access.service.js';

const owner = { id: 4, role: 'USER' } as RequestUser;
const stranger = { id: 9, role: 'USER' } as RequestUser;
const admin = { id: 5, role: 'ADMIN' } as RequestUser;

function createService() {
  const prisma = {
    listing: { findUnique: vi.fn() },
    chatThread: { findMany: vi.fn(), findFirst: vi.fn() },
    listingChatThread: { findMany: vi.fn(), findFirst: vi.fn() },
    inboxItem: { findMany: vi.fn(), findFirst: vi.fn() },
  };

  return {
    prisma,
    service: new AccessService(prisma as unknown as PrismaService),
  };
}

describe('AccessService', () => {
  it('allows the listing owner and admins, and rejects everyone else', async () => {
    const { prisma, service } = createService();
    prisma.listing.findUnique.mockResolvedValue({ id: 25, userId: 4, isActive: true });

    await expect(service.assertListingOwner(25, owner)).resolves.toMatchObject({ id: 25 });
    await expect(service.assertListingOwner(25, admin)).resolves.toMatchObject({ id: 25 });
    await expect(service.assertListingOwner(25, stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws 404 for a missing listing before checking ownership', async () => {
    const { prisma, service } = createService();
    prisma.listing.findUnique.mockResolvedValue(null);

    await expect(service.assertListingOwner(404, owner)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('treats the thread creator, inbox user and listing owner as participants', async () => {
    const { prisma, service } = createService();

    prisma.chatThread.findFirst.mockResolvedValueOnce({ id: 1 });
    await expect(service.isThreadParticipant(stranger, 1)).resolves.toBe(true);

    prisma.chatThread.findFirst.mockResolvedValueOnce(null);
    prisma.inboxItem.findFirst.mockResolvedValueOnce({ id: 2 });
    await expect(service.isThreadParticipant(stranger, 1)).resolves.toBe(true);

    prisma.chatThread.findFirst.mockResolvedValueOnce(null);
    prisma.inboxItem.findFirst.mockResolvedValueOnce(null);
    prisma.listingChatThread.findFirst.mockResolvedValueOnce({ id: 3 });
    await expect(service.isThreadParticipant(stranger, 1)).resolves.toBe(true);

    prisma.chatThread.findFirst.mockResolvedValueOnce(null);
    prisma.inboxItem.findFirst.mockResolvedValueOnce(null);
    prisma.listingChatThread.findFirst.mockResolvedValueOnce(null);
    await expect(service.isThreadParticipant(stranger, 1)).resolves.toBe(false);
  });

  it('lists the union of the user threads without duplicates', async () => {
    const { prisma, service } = createService();
    prisma.chatThread.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.listingChatThread.findMany.mockResolvedValue([
      { chatThreadId: 1 },
      { chatThreadId: 2 },
    ]);
    prisma.inboxItem.findMany.mockResolvedValue([{ chatThreadId: 3 }]);

    await expect(service.accessibleThreadIds(owner)).resolves.toEqual([1, 2, 3]);
  });
});
