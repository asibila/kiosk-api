import { z } from 'zod';
import { createDescriptionSchema } from './create-description.dto.js';

/** Partial translations: only the languages present in the body are updated. */
export const updateDescriptionSchema = createDescriptionSchema
  .partial()
  .refine((value) => Object.keys(value.translations ?? {}).length > 0, {
    message: 'At least one translation must be provided',
  });

export type UpdateDescriptionDto = z.infer<typeof updateDescriptionSchema>;
