import { z } from 'zod';
import { createChatThreadSchema } from './create-chat-thread.dto.js';

export const updateChatThreadSchema = createChatThreadSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateChatThreadDto = z.infer<typeof updateChatThreadSchema>;
