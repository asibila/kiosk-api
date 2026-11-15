import { Orientation } from '@prisma/client';
import { z } from 'zod';

export const createListingSchema = z.object({
  categoryId: z.number().int().positive(),
  orientation: z.enum(Orientation),
  userId: z.number().int().positive(),
});

export type CreateListingDto = z.infer<typeof createListingSchema>;
