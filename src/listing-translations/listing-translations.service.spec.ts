import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ListingTranslationsService } from './listing-translations.service.js';

const prisma = {
  listingTranslation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
};

const row = {
  listingId: 28,
  language: 'en',
  title: 'Carbon road bike',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: 1,
  updatedBy: null,
};

describe('ListingTranslationsService', () => {
  let service: ListingTranslationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ListingTranslationsService(prisma as unknown as PrismaService);
  });

  it('lists all titles or filters by listing', async () => {
    prisma.listingTranslation.findMany.mockResolvedValue([row]);

    await service.findAll();
    expect(prisma.listingTranslation.findMany).toHaveBeenCalledWith({
      where: undefined,
      select: expect.any(Object),
      orderBy: [{ listingId: 'asc' }, { language: 'asc' }],
    });

    await service.findAll(28);
    expect(prisma.listingTranslation.findMany).toHaveBeenLastCalledWith({
      where: { listingId: 28 },
      select: expect.any(Object),
      orderBy: [{ listingId: 'asc' }, { language: 'asc' }],
    });
  });

  it('upserts a title and stamps the actor', async () => {
    prisma.listingTranslation.upsert.mockResolvedValue(row);

    await service.upsert(
      { listingId: 28, language: 'en', title: 'Carbon road bike' },
      1,
    );

    expect(prisma.listingTranslation.upsert).toHaveBeenCalledWith({
      where: { listingId_language: { listingId: 28, language: 'en' } },
      create: {
        listingId: 28,
        language: 'en',
        title: 'Carbon road bike',
        createdBy: 1,
      },
      update: { title: 'Carbon road bike', updatedBy: 1 },
      select: expect.any(Object),
    });
  });

  it('throws when a translation is missing', async () => {
    prisma.listingTranslation.findUnique.mockResolvedValue(null);

    await expect(service.findOne(28, 'hr')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
