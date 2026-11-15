import { z } from 'zod';

export const createChatThreadSchema = z.object({
  userId: z.number().int().positive(),
});

export type CreateChatThreadDto = z.infer<typeof createChatThreadSchema>;
