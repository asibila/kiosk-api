import { z } from 'zod';
import { createFacetValueOptionSchema } from './create-facet-value-option.dto.js';

export const updateFacetValueOptionSchema = createFacetValueOptionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateFacetValueOptionDto = z.infer<
  typeof updateFacetValueOptionSchema
>;
