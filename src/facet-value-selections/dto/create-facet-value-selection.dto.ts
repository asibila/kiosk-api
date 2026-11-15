import { z } from 'zod';

export const createFacetValueSelectionSchema = z.object({
  facetValueOptionId: z.number().int().positive(),
  listingId: z.number().int().positive(),
});

export type CreateFacetValueSelectionDto = z.infer<
  typeof createFacetValueSelectionSchema
>;
