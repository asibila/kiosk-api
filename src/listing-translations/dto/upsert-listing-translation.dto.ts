import { z } from 'zod';

/**
 * Create or replace one listing title translation. The API upserts on
 * `(listingId, language)`, so the same call adds a missing language and updates
 * an existing one.
 */
export const upsertListingTranslationSchema = z.object({
  listingId: z.number().int().positive(),
  language: z.string().trim().min(2).max(10),
  title: z.string().trim().min(1, 'Title is required').max(225),
});

export type UpsertListingTranslationDto = z.infer<
  typeof upsertListingTranslationSchema
>;
