import { z } from 'zod';

/** Every reason a listing can be removed, for both orientations. */
export const LISTING_OUTCOMES = [
  'sold',
  'sale_fell_through',
  'kept',
  'gave_away',
  'purchased',
  'purchase_fell_through',
  'no_longer_needed',
  'bought_elsewhere',
] as const;

export const createListingOutcomeSchema = z.object({
  listingId: z.number().int().positive(),
  outcome: z.enum(LISTING_OUTCOMES),
  /**
   * The final price for a completed sale/purchase. Only meaningful for `sold`
   * and `purchased`; the service clears it for every other outcome.
   */
  finalPrice: z.number().nonnegative().nullish(),
});

export type CreateListingOutcomeDto = z.infer<typeof createListingOutcomeSchema>;
