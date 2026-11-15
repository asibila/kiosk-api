import { z } from 'zod';
import { createChatMessageSchema } from './create-chat-message.dto.js';

export const updateChatMessageSchema = createChatMessageSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateChatMessageDto = z.infer<typeof updateChatMessageSchema>;
