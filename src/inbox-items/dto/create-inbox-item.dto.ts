import { z } from 'zod';

export const createInboxItemSchema = z.object({
  /** Ignored: the inbox row belongs to the signed-in user. */
  userId: z.number().int().positive().optional(),
  chatThreadId: z.number().int().positive(),
});

export type CreateInboxItemDto = z.infer<typeof createInboxItemSchema>;
