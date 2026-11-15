import { z } from 'zod';

// A chat thread has no mutable fields; PATCH only refreshes the audit columns.
export const updateChatThreadSchema = z.object({});

export type UpdateChatThreadDto = z.infer<typeof updateChatThreadSchema>;
