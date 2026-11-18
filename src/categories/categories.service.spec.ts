import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DescriptionsService } from '../descriptions/descriptions.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  CategoriesService,
  facetsCountMaxAnswerableFor,
  facetsCountMaxFor,
} from './categories.service.js';

/** `parents` maps every category id to its parent id, or to null for a root. */
function createService(parents: Record<number, number | null>) {
  const prisma = {
    category: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        where.id in parents ? { parentCategoryId: parents[where.id] } : null,
      ),
      findMany: vi.fn(async () =>
        Object.entries(parents).map(([id, parentCategoryId]) => ({
          id: Number(id),
          parentCategoryId,
        })),
      ),
      update: vi.fn(async () => ({ id: 1 })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 1,
        ...data,
      })),
    },
    facetSchema: {
      findMany: vi.fn(async () => [
        { id: 1, categoryId: 1, isGeneric: true },
      ]),
    },
  };
  const descriptions = { assertExists: vi.fn(async () => undefined) };
  const service = new CategoriesService(
    prisma as unknown as PrismaService,
    descriptions as unknown as DescriptionsService,
  );

  return { service, prisma };
}

describe('facetsCountMaxFor', () => {
  const categories = [
    { id: 1, parentCategoryId: null },
    { id: 2, parentCategoryId: 1 },
    { id: 3, parentCategoryId: null },
    { id: 4, parentCategoryId: null },
  ];
  const facetSchemas = [
    { id: 1, categoryId: 1, isGeneric: true },
    { id: 2, categoryId: 1, isGeneric: false },
    { id: 3, categoryId: 2, isGeneric: false },
    { id: 4, categoryId: 3, isGeneric: false },
  ];

  it('counts generic facets, orientation and the two range questions for the all category', () => {
    expect(facetsCountMaxFor(0, categories, facetSchemas)).toBe(4);
    expect(facetsCountMaxAnswerableFor(0, categories, facetSchemas)).toBe(2);
  });

  it('counts option facets separately from numeric facets', () => {
    const withTypes = [
      { id: 1, categoryId: 1, isGeneric: true, name: 'orientation', type: 'option' as const },
      { id: 2, categoryId: 1, isGeneric: true, name: 'condition', type: 'option' as const },
      { id: 3, categoryId: 1, isGeneric: true, name: 'price', type: 'numeric' as const },
      { id: 4, categoryId: 1, isGeneric: true, name: 'year', type: 'numeric' as const },
    ];

    expect(facetsCountMaxFor(0, categories, withTypes)).toBe(4);
    expect(facetsCountMaxAnswerableFor(0, categories, withTypes)).toBe(2);
  });

  it('adds the orientation and range questions when their facet rows are missing', () => {
    const oneRange = [
      { id: 1, categoryId: 1, isGeneric: true, name: 'condition', type: 'option' as const },
      { id: 2, categoryId: 1, isGeneric: true, name: 'price', type: 'numeric' as const },
    ];

    expect(facetsCountMaxFor(0, categories, oneRange)).toBe(4);
    expect(facetsCountMaxAnswerableFor(0, categories, oneRange)).toBe(2);
  });

  it('counts a category facet plus the facets inherited from ancestors', () => {
    // Category 2: generic condition, brand from category 1, its own facet,
    // orientation and the price/year range questions.
    expect(facetsCountMaxFor(2, categories, facetSchemas)).toBe(6);
    expect(facetsCountMaxAnswerableFor(2, categories, facetSchemas)).toBe(4);
  });

  it('counts a generic facet once when its category is also an ancestor', () => {
    // The generic facet is defined on category 1, which is also in the chain.
    expect(facetsCountMaxFor(1, categories, facetSchemas)).toBe(5);
  });

  it('returns the four shared questions for a root category without its own facets', () => {
    expect(facetsCountMaxFor(4, categories, facetSchemas)).toBe(4);
    expect(facetsCountMaxAnswerableFor(4, categories, facetSchemas)).toBe(2);
  });

  it('keeps the minimum of three when the generic facet has not been seeded', () => {
    expect(facetsCountMaxFor(4, categories, [])).toBe(3);
    expect(facetsCountMaxFor(0, categories, [])).toBe(3);
  });

  it('terminates when the stored category tree contains a cycle', () => {
    const cyclic = [
      { id: 5, parentCategoryId: 6 },
      { id: 6, parentCategoryId: 5 },
    ];
    const schemas = [{ id: 7, categoryId: 6, isGeneric: false }];

    expect(facetsCountMaxFor(5, cyclic, schemas)).toBe(4);
  });
});

describe('CategoriesService virtual all category', () => {
  it('can be read but not modified', async () => {
    const { service } = createService({ 1: null });

    await expect(service.update(0, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove(0)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CategoriesService.findAll', () => {
  it('returns the virtual all category first, followed by stored categories', async () => {
    const { service } = createService({ 1: null, 2: 1 });

    const rows = await service.findAll();

    expect(rows.map((row) => row.id)).toEqual([0, 1, 2]);
    expect(rows.map((row) => row.facetsCountMax)).toEqual([4, 4, 4]);
    expect(rows.map((row) => row.facetsCountMaxAnswerable)).toEqual([2, 2, 2]);
  });
});

describe('CategoriesService icons', () => {
  const ICON = '<svg viewBox="0 0 24 24" class="lucide" onload="alert(1)"><path d="M0 0h24" onclick="x" /></svg>';
  const SANITIZED =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24" /></svg>';

  it('sanitizes the SVG before creating the category', async () => {
    const { service, prisma } = createService({ 1: null });

    await service.create({ descriptionId: 5, iconSvg: ICON });

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iconSvg: SANITIZED }),
      }),
    );
  });

  it('sanitizes the SVG before updating the category', async () => {
    const { service, prisma } = createService({ 1: null });

    await service.update(1, { iconSvg: ICON });

    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iconSvg: SANITIZED }),
      }),
    );
  });

  it('rejects invalid markup without touching the database', async () => {
    const { service, prisma } = createService({ 1: null });

    await expect(
      service.update(1, { iconSvg: '<svg viewBox="0 0 24 24"><script /></svg>' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('clears the icon with null and leaves it untouched when omitted', async () => {
    const { service, prisma } = createService({ 1: null });

    await service.update(1, { iconSvg: null });
    expect(prisma.category.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { iconSvg: null } }),
    );

    await service.update(1, { parentCategoryId: null });
    expect(prisma.category.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { parentCategoryId: null } }),
    );
  });

  it('returns no icon for the virtual all category', async () => {
    const { service } = createService({ 1: null });

    const rows = await service.findAll();

    expect(rows[0]).toMatchObject({ id: 0, iconSvg: null });
  });
});

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
