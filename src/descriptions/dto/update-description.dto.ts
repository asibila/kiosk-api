import { z } from 'zod';
import { createDescriptionSchema } from './create-description.dto.js';

export const updateDescriptionSchema = createDescriptionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateDescriptionDto = z.infer<typeof updateDescriptionSchema>;
