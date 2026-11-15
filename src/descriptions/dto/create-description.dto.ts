import { Language } from '@prisma/client';
import { z } from 'zod';

export const createDescriptionSchema = z.object({
  language: z.enum(Language),
  text: z.string().trim().min(1, 'Text is required').max(225),
});

export type CreateDescriptionDto = z.infer<typeof createDescriptionSchema>;
