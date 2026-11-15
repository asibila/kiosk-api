import { z } from 'zod';
import { createCategorySchema } from './create-category.dto.js';

export const updateCategorySchema = createCategorySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
