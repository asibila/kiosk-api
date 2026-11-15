import { z } from 'zod';

export const createCategorySchema = z.object({
  descriptionId: z.number().int().positive(),
  parentCategoryId: z.number().int().positive().nullish(),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
