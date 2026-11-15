import { z } from 'zod';
import { createListingSchema } from './create-listing.dto.js';

export const updateListingSchema = createListingSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateListingDto = z.infer<typeof updateListingSchema>;
