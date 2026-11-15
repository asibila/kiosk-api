import { z } from 'zod';

export const createInboxItemSchema = z.object({
  userId: z.number().int().positive(),
  chatThreadId: z.number().int().positive(),
});

export type CreateInboxItemDto = z.infer<typeof createInboxItemSchema>;
