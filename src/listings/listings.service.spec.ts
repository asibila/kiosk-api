import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ListingsService } from './listings.service.js';

const audit = {
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: null,
  updatedBy: null,
};

function createService() {
  const rows = [
    {
      id: 10,
      categoryId: 2,
      orientation: 'sell' as const,
      userId: 1,
      isActive: true,
      ...audit,
      _count: { facetValueSelections: 3 },
    },
    {
      id: 11,
      categoryId: 2,
      orientation: 'buy' as const,
      userId: 2,
      isActive: true,
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
      create: vi.fn(async () => {
        const { _count: _ignored, ...row } = rows[1];
        return row;
      }),
      update: vi.fn(async () => {
        const { _count: _ignored, ...row } = rows[1];
        return row;
      }),
    },
    facetValueSelection: {
      count: vi.fn(
        async ({ where }: { where: { listingId: number } }) =>
          rows.find((row) => row.id === where.listingId)?._count
            .facetValueSelections ?? 0,
      ),
    },
  };

  const service = new ListingsService(prisma as unknown as PrismaService);

  return { service, prisma };
}

describe('ListingsService.facetsCount', () => {
  it('adds the number of selections to every listing', async () => {
    const { service } = createService();

    const rows = await service.findAll();

    expect(rows.map((row) => [row.id, row.facetsCount])).toEqual([
      [10, 3],
      [11, 0],
    ]);
  });

  it('adds the number of selections to a single listing', async () => {
    const { service } = createService();

    await expect(service.findOne(10)).resolves.toMatchObject({
      id: 10,
      facetsCount: 3,
    });
  });

  it('keeps the not-found behavior of the CRUD service', async () => {
    const { service } = createService();

    await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports zero selections for a freshly created listing', async () => {
    const { service } = createService();

    await expect(
      service.create({
        categoryId: 2,
        orientation: 'sell',
        userId: 1,
        isActive: false,
      }),
    ).resolves.toMatchObject({ id: 11, facetsCount: 0 });
  });

  it('recounts the selections after an update', async () => {
    const { service } = createService();

    await expect(service.update(11, { isActive: true })).resolves.toMatchObject({
      id: 11,
      facetsCount: 0,
    });
  });
});
