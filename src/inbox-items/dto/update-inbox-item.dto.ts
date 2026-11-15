import { z } from 'zod';
import { createInboxItemSchema } from './create-inbox-item.dto.js';

export const updateInboxItemSchema = createInboxItemSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateInboxItemDto = z.infer<typeof updateInboxItemSchema>;
