import { z } from 'zod';

/**
 * All translations of one description, keyed by language code. The service
 * enforces that every language configured in the Language table is present, so
 * a description always has both texts.
 */
export const createDescriptionSchema = z.object({
  translations: z.record(
    z.string().trim().min(1, 'Language code is required').max(10),
    z.string().trim().min(1, 'Text is required').max(225),
  ),
});

export type CreateDescriptionDto = z.infer<typeof createDescriptionSchema>;
