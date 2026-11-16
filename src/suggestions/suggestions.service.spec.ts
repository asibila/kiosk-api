import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SuggestionsService } from './suggestions.service.js';

interface CatalogData {
  categories: { id: number; parentCategoryId: number | null }[];
  facetSchemas: {
    id: number;
    descriptionId: number;
    name: string;
    categoryId: number;
    isGeneric: boolean;
  }[];
  facetOptions: { id: number; descriptionId: number; schemaId: number }[];
  descriptions: { id: number; language: string; text: string }[];
  listings: { id: number; categoryId: number; orientation: 'buy' | 'sell' }[];
  selections: { listingId: number; facetValueOptionId: number }[];
}

function createService(data: Partial<CatalogData>) {
  const prisma = {
    description: { findMany: vi.fn(async () => data.descriptions ?? []) },
    listing: { findMany: vi.fn(async () => data.listings ?? []) },
    category: { findMany: vi.fn(async () => data.categories ?? []) },
    facetSchema: { findMany: vi.fn(async () => data.facetSchemas ?? []) },
    facetValueOption: { findMany: vi.fn(async () => data.facetOptions ?? []) },
    facetValueSelection: { findMany: vi.fn(async () => data.selections ?? []) },
  };

  return new SuggestionsService(prisma as unknown as PrismaService);
}

const brandDescriptions = [
  { id: 100, language: 'en', text: 'Brand' },
  { id: 200, language: 'en', text: 'Acme' },
];

const acmeSuggestion = {
  facet: 'brand',
  facetLabel: 'Brand',
  valueId: '20',
  label: 'Acme',
  count: 1,
};

describe('SuggestionsService.suggest', () => {
  it('offers a facet defined on an ancestor category', async () => {
    const service = createService({
      categories: [
        { id: 1, parentCategoryId: null },
        { id: 2, parentCategoryId: 1 },
      ],
      facetSchemas: [
        { id: 10, descriptionId: 100, name: 'brand', categoryId: 1, isGeneric: false },
      ],
      facetOptions: [{ id: 20, descriptionId: 200, schemaId: 10 }],
      descriptions: brandDescriptions,
      listings: [{ id: 1, categoryId: 2, orientation: 'sell' }],
      selections: [{ listingId: 1, facetValueOptionId: 20 }],
    });

    await expect(
      service.suggest({ q: '', lang: 'en', categoryId: 2, chips: [] }),
    ).resolves.toEqual({ suggestions: [acmeSuggestion] });
  });

  it('still finishes when stored categories form a cycle', async () => {
    // Category 1 is its own parent, and categories 2 and 3 point at each other.
    const service = createService({
      categories: [
        { id: 1, parentCategoryId: 1 },
        { id: 2, parentCategoryId: 3 },
        { id: 3, parentCategoryId: 2 },
      ],
      facetSchemas: [
        { id: 10, descriptionId: 100, name: 'brand', categoryId: 2, isGeneric: false },
      ],
      facetOptions: [{ id: 20, descriptionId: 200, schemaId: 10 }],
      descriptions: brandDescriptions,
      listings: [{ id: 1, categoryId: 2, orientation: 'sell' }],
      selections: [{ listingId: 1, facetValueOptionId: 20 }],
    });

    await expect(
      service.suggest({ q: '', lang: 'en', categoryId: 2, chips: [] }),
    ).resolves.toEqual({ suggestions: [acmeSuggestion] });
  });
});
