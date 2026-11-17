import { z } from 'zod';

/**
 * All translations of one description, keyed by language code. The service
 * enforces that every language configured in the Language table is present, so
 * a description always has both texts.
 *
 * `name` is the React i18n key for interface strings (`common.close`). Entity
 * descriptions for categories and facets omit it and keep `name` null.
 */
export const createDescriptionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/,
      'Name must be a dotted i18n key, for example common.close',
    )
    .optional(),
  translations: z.record(
    z.string().trim().min(1, 'Language code is required').max(10),
    z.string().trim().min(1, 'Text is required').max(225),
  ),
});

export type CreateDescriptionDto = z.infer<typeof createDescriptionSchema>;
