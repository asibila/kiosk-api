import { z } from 'zod';

export const updateListingImageSchema = z.object({
  primaryImage: z.boolean(),
});

export type UpdateListingImageDto = z.infer<typeof updateListingImageSchema>;
