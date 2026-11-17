import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type SuggestionChip =
  | { kind: 'value'; facet: string; valueId: string }
  | {
      kind: 'range';
      facet: string;
      min: number | null;
      max: number | null;
      unit?: string;
    };

export interface Suggestion {
  facet: string;
  facetLabel: string;
  valueId: string;
  label: string;
  count: number;
}

export interface SuggestOptions {
  q: string;
  lang: string;
  categoryId?: number;
  orientation?: 'buy' | 'sell';
  chips: SuggestionChip[];
}

/**
 * Builds autocomplete suggestions from the structured facet model. Ads are
 * matched through `FacetValueSelection` rows, never through free text, so the
 * only text search here is against the facet/value labels themselves.
 */
@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(options: SuggestOptions): Promise<{ suggestions: Suggestion[] }> {
    const [descriptions, listings, categories, facetSchemas, facetOptions, selections] =
      await Promise.all([
        this.prisma.description.findMany({
          select: { id: true, language: true, text: true },
        }),
        this.prisma.listing.findMany({
          select: { id: true, categoryId: true, orientation: true },
        }),
        this.prisma.category.findMany({
          select: { id: true, parentCategoryId: true },
        }),
        this.prisma.facetSchema.findMany({
          select: {
            id: true,
            descriptionId: true,
            name: true,
            categoryId: true,
            isGeneric: true,
          },
        }),
        this.prisma.facetValueOption.findMany({
          select: { id: true, descriptionId: true, schemaId: true },
        }),
        this.prisma.facetValueSelection.findMany({
          select: { listingId: true, facetValueOptionId: true },
        }),
      ]);

    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const categoryChain = new Set<number>();
    if (options.categoryId !== undefined) {
      let current = categoriesById.get(options.categoryId);
      // Stops at the first repeated category, so a cycle in stored data ends the walk.
      while (current && !categoryChain.has(current.id)) {
        categoryChain.add(current.id);
        current =
          current.parentCategoryId != null
            ? categoriesById.get(current.parentCategoryId)
            : undefined;
      }
    }

    const translations = new Map<number, Record<string, string>>();
    for (const row of descriptions) {
      const group = translations.get(row.id) ?? {};
      group[row.language] = row.text;
      translations.set(row.id, group);
    }
    const descriptionText = (id: number, lang: string): string => {
      const group = translations.get(id);
      if (!group) return '';
      return group[lang] ?? group.en ?? Object.values(group)[0] ?? '';
    };

    const selectedValueIds = new Set(
      options.chips
        .filter(
          (chip): chip is Extract<SuggestionChip, { kind: 'value' }> =>
            chip.kind === 'value',
        )
        .map((chip) => Number(chip.valueId))
        .filter((id) => Number.isInteger(id) && id > 0),
    );

    // Orientation is a facet in the clients, but its value is stored on the
    // listing instead of a selection, so it is applied to the listing rows.
    const orientationChip = options.chips.find(
      (chip) => chip.kind === 'value' && chip.facet === 'orientation',
    );
    const orientation =
      orientationChip && orientationChip.kind === 'value' &&
      (orientationChip.valueId === 'buy' || orientationChip.valueId === 'sell')
        ? orientationChip.valueId
        : options.orientation;

    // A facet can only hold one value per listing in this schema, so hide a
    // facet that already has a chip instead of offering an impossible AND.
    const selectedFacets = new Set(
      options.chips
        .filter((chip) => chip.kind === 'value')
        .map((chip) => chip.facet),
    );

    const selectionsByListing = new Map<number, Set<number>>();
    for (const selection of selections) {
      const owned = selectionsByListing.get(selection.listingId) ?? new Set();
      owned.add(selection.facetValueOptionId);
      selectionsByListing.set(selection.listingId, owned);
    }

    const candidateListings = listings.filter((listing) => {
      if (options.categoryId !== undefined && listing.categoryId !== options.categoryId) {
        return false;
      }
      if (orientation && listing.orientation !== orientation) {
        return false;
      }
      const owned = selectionsByListing.get(listing.id);
      if (!owned) return selectedValueIds.size === 0;
      for (const valueId of selectedValueIds) {
        if (!owned.has(valueId)) return false;
      }
      return true;
    });

    const countByOption = new Map<number, number>();
    for (const listing of candidateListings) {
      const owned = selectionsByListing.get(listing.id);
      if (!owned) continue;
      for (const optionId of owned) {
        countByOption.set(optionId, (countByOption.get(optionId) ?? 0) + 1);
      }
    }

    const schemaById = new Map(facetSchemas.map((schema) => [schema.id, schema]));
    const query = options.q.trim().toLowerCase();
    const matches = (label: string, facetLabel: string, name: string): boolean => {
      if (!query) return true;
      return (
        label.toLowerCase().includes(query) ||
        facetLabel.toLowerCase().includes(query) ||
        name.toLowerCase().includes(query)
      );
    };

    const suggestions: Suggestion[] = [];
    for (const option of facetOptions) {
      if (selectedValueIds.has(option.id)) continue;

      const schema = schemaById.get(option.schemaId);
      if (!schema) continue;
      if (
        options.categoryId !== undefined &&
        !schema.isGeneric &&
        !categoryChain.has(schema.categoryId)
      ) {
        continue;
      }
      if (selectedFacets.has(schema.name)) continue;

      const facetLabel = descriptionText(schema.descriptionId, options.lang) || schema.name;
      const label = descriptionText(option.descriptionId, options.lang) || `Option ${option.id}`;
      if (!matches(label, facetLabel, schema.name)) continue;

      const count = countByOption.get(option.id) ?? 0;
      if (count <= 0) continue;

      suggestions.push({
        facet: schema.name,
        facetLabel,
        valueId: String(option.id),
        label,
        count,
      });
    }

    const locale = options.lang === 'hr' ? 'hr' : 'en';
    suggestions.sort(
      (a, b) =>
        a.facetLabel.localeCompare(b.facetLabel, locale) ||
        b.count - a.count ||
        a.label.localeCompare(b.label, locale),
    );

    return { suggestions: suggestions.slice(0, 60) };
  }
}

export function parseChips(raw: string | undefined): SuggestionChip[] {
  if (!raw) return [];

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new BadRequestException('chips must be valid JSON');
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException('chips must be a JSON array');
  }

  return value.map((entry, index) => {
    if (entry === null || typeof entry !== 'object') {
      throw new BadRequestException(`chips[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    const kind = record.kind;
    const facet = record.facet;
    if (typeof facet !== 'string' || facet.length === 0) {
      throw new BadRequestException(`chips[${index}].facet is required`);
    }

    if (kind === 'value') {
      const valueId = record.valueId;
      if (typeof valueId !== 'string' && typeof valueId !== 'number') {
        throw new BadRequestException(`chips[${index}].valueId is required`);
      }
      return { kind: 'value', facet, valueId: String(valueId) };
    }

    if (kind === 'range') {
      return {
        kind: 'range',
        facet,
        min: typeof record.min === 'number' ? record.min : null,
        max: typeof record.max === 'number' ? record.max : null,
        ...(typeof record.unit === 'string' ? { unit: record.unit } : {}),
      };
    }

    throw new BadRequestException(`chips[${index}].kind must be "value" or "range"`);
  });
}
