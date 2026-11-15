import { z } from 'zod';

export const createChatMessageSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(225),
  threadId: z.number().int().positive(),
  userId: z.number().int().positive().optional(),
});

export type CreateChatMessageDto = z.infer<typeof createChatMessageSchema>;
