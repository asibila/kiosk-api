import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/current-user.decorator.js';
import type { AccessService } from '../common/access.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ListingChatThreadsService } from './listing-chat-threads.service.js';

const user: RequestUser = {
  id: 7,
  name: 'Ana',
  email: 'ana@example.com',
  role: 'USER',
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function createService(existing: Record<string, unknown> | null = null) {
  const prisma = {
    listingChatThread: {
      findUnique: vi.fn(async () => existing),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 1,
        ...data,
      })),
    },
  };
  const access = {
    assertThreadCreator: vi.fn(async () => undefined),
  };
  const service = new ListingChatThreadsService(
    prisma as unknown as PrismaService,
    access as unknown as AccessService,
  );

  return { service, prisma, access };
}

describe('ListingChatThreadsService.create', () => {
  it('stores the contact initiator as the link user', async () => {
    const { service, prisma, access } = createService();

    await service.create({ listingId: 10, chatThreadId: 5 }, user);

    expect(access.assertThreadCreator).toHaveBeenCalledWith(user, 5);
    expect(prisma.listingChatThread.findUnique).toHaveBeenCalledWith({
      where: { userId_listingId: { userId: user.id, listingId: 10 } },
      select: expect.any(Object),
    });
    expect(prisma.listingChatThread.create).toHaveBeenCalledWith({
      data: {
        listingId: 10,
        chatThreadId: 5,
        userId: user.id,
        createdBy: user.id,
      },
      select: expect.any(Object),
    });
  });

  it('reuses the one conversation the user already has with a listing', async () => {
    const link = {
      id: 3,
      listingId: 10,
      chatThreadId: 4,
      userId: user.id,
      hasUnread: false,
    };
    const { service, prisma } = createService(link);

    const result = await service.create({ listingId: 10, chatThreadId: 5 }, user);

    expect(result).toBe(link);
    expect(prisma.listingChatThread.create).not.toHaveBeenCalled();
  });

  it('reuses the conversation that won a simultaneous contact race', async () => {
    const link = {
      id: 3,
      listingId: 10,
      chatThreadId: 4,
      userId: user.id,
      hasUnread: false,
    };
    const { service, prisma } = createService();
    prisma.listingChatThread.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(link);
    prisma.listingChatThread.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await service.create({ listingId: 10, chatThreadId: 5 }, user);

    expect(result).toBe(link);
  });
});
