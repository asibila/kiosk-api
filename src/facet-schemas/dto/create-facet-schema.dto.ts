import { z } from 'zod';

export const createFacetSchemaSchema = z.object({
  descriptionId: z.number().int().positive(),
  name: z.string().trim().min(1, 'Name is required').max(225),
  categoryId: z.number().int().positive(),
  isGeneric: z.boolean().optional(),
});

export type CreateFacetSchemaDto = z.infer<typeof createFacetSchemaSchema>;
