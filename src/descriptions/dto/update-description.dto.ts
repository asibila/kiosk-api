import { z } from 'zod';
import { createDescriptionSchema } from './create-description.dto.js';

/**
 * Partial update: only the languages present in the body are updated. A name
 * can be renamed on its own, without resending every translation.
 */
export const updateDescriptionSchema = createDescriptionSchema
  .partial()
  .refine(
    (value) =>
      value.name !== undefined ||
      Object.keys(value.translations ?? {}).length > 0,
    { message: 'At least one field must be provided' },
  );

export type UpdateDescriptionDto = z.infer<typeof updateDescriptionSchema>;
