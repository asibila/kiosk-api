import { z } from 'zod';

export const createFacetValueOptionSchema = z.object({
  descriptionId: z.number().int().positive(),
  schemaId: z.number().int().positive(),
});

export type CreateFacetValueOptionDto = z.infer<
  typeof createFacetValueOptionSchema
>;
