import { z } from 'zod';

export const facetTypeSchema = z.enum(['numeric', 'option']);

export const createFacetSchemaSchema = z.object({
  descriptionId: z.number().int().positive(),
  name: z.string().trim().min(1, 'Name is required').max(225),
  categoryId: z.number().int().positive(),
  isGeneric: z.boolean().optional(),
  type: facetTypeSchema.optional(),
  required: z.boolean().optional(),
});

export type CreateFacetSchemaDto = z.infer<typeof createFacetSchemaSchema>;
