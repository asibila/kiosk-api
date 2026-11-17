import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { RequestUser } from '../auth/current-user.decorator.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ListingsService } from './listings.service.js';

const audit = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: null,
  updatedBy: null,
};

const user = { id: 1, role: 'USER' } as RequestUser;

function createService() {
  const rows = [
    {
      id: 10,
      categoryId: 2,
      regionId: 0,
      orientation: 'sell' as const,
      userId: 1,
      isActive: true,
      price: 199.99,
      year: 2024,
      ...audit,
      _count: { facetValueSelections: 3 },
    },
    {
      id: 11,
      categoryId: 2,
      regionId: 0,
      orientation: 'buy' as const,
      userId: 2,
      isActive: true,
      price: null,
      year: null,
      ...audit,
      _count: { facetValueSelections: 0 },
    },
  ];

  const prisma = {
    listing: {
      findMany: vi.fn(async () => rows),
      findUnique: vi.fn(
        async ({ where }: { where: { id: number } }) =>
          rows.find((row) => row.id === where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const { _count: _ignored, ...row } = rows[1];
        return {
          ...row,
          userId: data.userId,
          price: data.price ?? null,
          year: data.year ?? null,
        };
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const { _count: _ignored, ...row } = rows[1];
        return { ...row, price: data.price ?? null, year: data.year ?? null };
      }),
      delete: vi.fn(async () => rows[1]),
    },
    facetValueSelection: {
      count: vi.fn(
        async ({ where }: { where: { listingId: number } }) =>
          rows.find((row) => row.id === where.listingId)?._count
            .facetValueSelections ?? 0,
      ),
    },
  };

  const access = {
    assertListingOwner: vi.fn(async () => ({
      id: 11,
      userId: 1,
      isActive: true,
    })),
  };

  const service = new ListingsService(
    prisma as unknown as PrismaService,
    access as never,
  );

  return { service, prisma, access };
}

describe('ListingsService.facetsCount', () => {
  it('counts selections plus orientation, price and year', async () => {
    const { service } = createService();

    const rows = await service.findAll();

    expect(rows.map((row) => [row.id, row.facetsCount])).toEqual([
      [10, 6],
      [11, 1],
    ]);
  });

  it('adds the number of selections and field answers to a single listing', async () => {
    const { service } = createService();

    await expect(service.findOne(10)).resolves.toMatchObject({
      id: 10,
      facetsCount: 6,
    });
  });

  it('keeps the not-found behavior for missing listings', async () => {
    const { service } = createService();

    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forces the owner from the session on create', async () => {
    const { service, prisma } = createService();

    await expect(
      service.create(
        {
          categoryId: 2,
          orientation: 'sell',
          userId: 99,
          isActive: false,
        },
        user,
      ),
    ).resolves.toMatchObject({ id: 11, userId: 1, facetsCount: 1 });

    expect(prisma.listing.create.mock.calls[0][0].data).toMatchObject({
      userId: 1,
      createdBy: 1,
    });
  });

  it('counts price and year supplied on create', async () => {
    const { service } = createService();

    await expect(
      service.create(
        {
          categoryId: 2,
          orientation: 'sell',
          userId: 1,
          isActive: false,
          price: 199.99,
          year: 2024,
        },
        user,
      ),
    ).resolves.toMatchObject({ id: 11, facetsCount: 3 });
  });

  it('checks ownership and recounts after an update', async () => {
    const { service, access } = createService();

    await expect(
      service.update(11, { isActive: true }, user),
    ).resolves.toMatchObject({ id: 11, facetsCount: 1 });

    expect(access.assertListingOwner).toHaveBeenCalledWith(11, user);
  });

  it('checks ownership on delete', async () => {
    const { service, access } = createService();

    await service.remove(11, user);

    expect(access.assertListingOwner).toHaveBeenCalledWith(11, user);
  });
});
