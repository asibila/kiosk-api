import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/current-user.decorator.js';
import type { AccessService } from '../common/access.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ListingOutcomesService } from './listing-outcomes.service.js';

const owner: RequestUser = {
  id: 7,
  name: 'Ana',
  email: 'ana@example.com',
  role: 'USER',
  isActive: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const other: RequestUser = { ...owner, id: 8 };
const admin: RequestUser = { ...owner, id: 9, role: 'ADMIN' };

const sellListing = { id: 10, userId: 7, categoryId: 3, orientation: 'sell' };

function createService({
  existing = sellListing as typeof sellListing | null,
} = {}) {
  const prisma = {
    listing: { findUnique: vi.fn(async () => existing) },
    listingOutcome: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 1,
        ...data,
      })),
    },
  };
  const access = {
    isAdmin: (user: RequestUser | null) => user?.role === 'ADMIN',
  };
  const service = new ListingOutcomesService(
    prisma as unknown as PrismaService,
    access as unknown as AccessService,
  );

  return { service, prisma };
}

describe('ListingOutcomesService.create', () => {
  it('records a sold listing with its final price', async () => {
    const { service, prisma } = createService();

    await service.create(
      { listingId: 10, outcome: 'sold', finalPrice: 240 },
      owner,
    );

    expect(prisma.listingOutcome.create).toHaveBeenCalledWith({
      data: {
        listingId: 10,
        userId: 7,
        categoryId: 3,
        outcome: 'sold',
        finalPrice: 240,
      },
      select: expect.any(Object),
    });
  });

  it('records a purchased listing with its final price', async () => {
    const { service, prisma } = createService({
      existing: { ...sellListing, orientation: 'buy' },
    });

    await service.create(
      { listingId: 10, outcome: 'purchased', finalPrice: 300 },
      owner,
    );

    expect(prisma.listingOutcome.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: 'purchased',
          finalPrice: 300,
        }),
      }),
    );
  });

  it('clears the price for outcomes that are not a completed deal', async () => {
    const { service, prisma } = createService();

    await service.create(
      { listingId: 10, outcome: 'sale_fell_through', finalPrice: 240 },
      owner,
    );

    expect(prisma.listingOutcome.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: 'sale_fell_through',
          finalPrice: null,
        }),
      }),
    );
  });

  it('keeps the row when the price was left blank', async () => {
    const { service, prisma } = createService();

    await service.create({ listingId: 10, outcome: 'sold' }, owner);

    expect(prisma.listingOutcome.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: 'sold', finalPrice: null }),
      }),
    );
  });

  it('rejects an outcome from the other orientation', async () => {
    const { service, prisma } = createService();

    await expect(
      service.create({ listingId: 10, outcome: 'purchased' }, owner),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.listingOutcome.create).not.toHaveBeenCalled();
  });

  it('rejects a listing that no longer exists', async () => {
    const { service, prisma } = createService({ existing: null });

    await expect(
      service.create({ listingId: 99, outcome: 'kept' }, owner),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.listingOutcome.create).not.toHaveBeenCalled();
  });

  it('rejects someone else’s listing', async () => {
    const { service, prisma } = createService();

    await expect(
      service.create({ listingId: 10, outcome: 'sold' }, other),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.listingOutcome.create).not.toHaveBeenCalled();
  });

  it('lets an admin record an outcome for any listing', async () => {
    const { service, prisma } = createService();

    await service.create(
      { listingId: 10, outcome: 'sold', finalPrice: 1 },
      admin,
    );

    expect(prisma.listingOutcome.create).toHaveBeenCalledTimes(1);
  });
});
