import { z } from 'zod';
import { createFacetValueSelectionSchema } from './create-facet-value-selection.dto.js';

export const updateFacetValueSelectionSchema = createFacetValueSelectionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateFacetValueSelectionDto = z.infer<
  typeof updateFacetValueSelectionSchema
>;
