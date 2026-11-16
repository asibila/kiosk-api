import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DescriptionsService } from '../descriptions/descriptions.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesService } from './categories.service.js';

/** `parents` maps every category id to its parent id, or to null for a root. */
function createService(parents: Record<number, number | null>) {
  const prisma = {
    category: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        where.id in parents ? { parentCategoryId: parents[where.id] } : null,
      ),
      update: vi.fn(async () => ({ id: 1 })),
    },
  };
  const descriptions = { assertExists: vi.fn(async () => undefined) };
  const service = new CategoriesService(
    prisma as unknown as PrismaService,
    descriptions as unknown as DescriptionsService,
  );

  return { service, prisma };
}

describe('CategoriesService.update', () => {
  it('rejects a category that is made its own parent', async () => {
    const { service, prisma } = createService({ 1: null });

    await expect(service.update(1, { parentCategoryId: 1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('rejects a parent that is a descendant of the category', async () => {
    // 3 is under 2 and 2 is under 1, so putting 1 under 3 would close a loop.
    const { service, prisma } = createService({ 1: null, 2: 1, 3: 2 });

    await expect(service.update(1, { parentCategoryId: 3 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('accepts a parent from another branch', async () => {
    const { service, prisma } = createService({ 1: null, 2: null, 3: 2 });

    await service.update(1, { parentCategoryId: 3 });

    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { parentCategoryId: 3 } }),
    );
  });

  it('clears the parent without walking the tree', async () => {
    const { service, prisma } = createService({ 1: 2, 2: null });

    await service.update(1, { parentCategoryId: null });

    expect(prisma.category.findUnique).not.toHaveBeenCalled();
    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { parentCategoryId: null } }),
    );
  });

  it('still finishes when the stored tree already contains a cycle', async () => {
    // 6 and 7 point at each other. The walk must stop instead of spinning.
    const { service, prisma } = createService({ 1: null, 5: 6, 6: 7, 7: 6 });

    await service.update(1, { parentCategoryId: 5 });

    expect(prisma.category.update).toHaveBeenCalledTimes(1);
  });
});
