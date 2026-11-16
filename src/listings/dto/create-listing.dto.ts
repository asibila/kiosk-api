import { Orientation } from '@prisma/client';
import { z } from 'zod';

export const createListingSchema = z.object({
  categoryId: z.number().int().positive(),
  orientation: z.enum(Orientation),
  userId: z.number().int().positive(),
  isActive: z.boolean().optional(),
  price: z.number().finite().nonnegative().nullable().optional(),
  year: z.number().int().min(0).max(9999).nullable().optional(),
});

export type CreateListingDto = z.infer<typeof createListingSchema>;
