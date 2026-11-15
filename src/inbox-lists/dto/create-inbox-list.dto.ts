import { z } from 'zod';

export const createInboxListSchema = z.object({
  userId: z.number().int().positive(),
});

export type CreateInboxListDto = z.infer<typeof createInboxListSchema>;
