-- More reasons for removing a listing, split by orientation:
--   sell: sold, sale_fell_through, kept, gave_away
--   buy:  purchased, purchase_fell_through, no_longer_needed, bought_elsewhere
ALTER TYPE "ListingOutcomeType" ADD VALUE 'sale_fell_through';
ALTER TYPE "ListingOutcomeType" ADD VALUE 'gave_away';
ALTER TYPE "ListingOutcomeType" ADD VALUE 'purchased';
ALTER TYPE "ListingOutcomeType" ADD VALUE 'purchase_fell_through';
ALTER TYPE "ListingOutcomeType" ADD VALUE 'no_longer_needed';
ALTER TYPE "ListingOutcomeType" ADD VALUE 'bought_elsewhere';

-- `soldPrice` was sale-specific; the same column now holds the final price for
-- a completed sale or purchase, so rename it without losing rows.
ALTER TABLE "ListingOutcome" RENAME COLUMN "soldPrice" TO "finalPrice";
