import { z } from 'zod';

// Chat threads have no caller-supplied fields: the participants are derived from
// the linked listing and inbox item, while audit columns are stamped server-side.
export const createChatThreadSchema = z.object({});

export type CreateChatThreadDto = z.infer<typeof createChatThreadSchema>;
