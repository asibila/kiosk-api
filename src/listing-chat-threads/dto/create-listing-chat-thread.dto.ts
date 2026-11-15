import { z } from 'zod';

export const createListingChatThreadSchema = z.object({
  listingId: z.number().int().positive(),
  chatThreadId: z.number().int().positive(),
});

export type CreateListingChatThreadDto = z.infer<
  typeof createListingChatThreadSchema
>;
