import { z } from 'zod';
import { createListingChatThreadSchema } from './create-listing-chat-thread.dto.js';

export const updateListingChatThreadSchema = createListingChatThreadSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateListingChatThreadDto = z.infer<
  typeof updateListingChatThreadSchema
>;
