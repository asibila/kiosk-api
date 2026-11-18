import { z } from 'zod';

/**
 * Body of the listing view beacon. Both fields are optional: a plain page view
 * sends `{}`. `source` is a short label (`search`, `direct`, ...), not free
 * text, and `language` is one of the UI languages.
 */
export const createListingViewSchema = z
  .object({
    source: z
      .string()
      .trim()
      .regex(/^[a-z0-9_-]{1,40}$/i)
      .optional(),
    language: z.enum(['en', 'hr']).optional(),
  })
  .default({});

export type CreateListingViewDto = z.infer<typeof createListingViewSchema>;
