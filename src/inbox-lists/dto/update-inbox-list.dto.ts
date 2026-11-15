import { z } from 'zod';
import { createInboxListSchema } from './create-inbox-list.dto.js';

export const updateInboxListSchema = createInboxListSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateInboxListDto = z.infer<typeof updateInboxListSchema>;
