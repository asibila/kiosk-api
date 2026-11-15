import { z } from 'zod';
import { createFacetSchemaSchema } from './create-facet-schema.dto.js';

export const updateFacetSchemaSchema = createFacetSchemaSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateFacetSchemaDto = z.infer<typeof updateFacetSchemaSchema>;
