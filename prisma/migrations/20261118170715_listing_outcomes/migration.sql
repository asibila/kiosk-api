-- CreateEnum
CREATE TYPE "ListingOutcomeType" AS ENUM ('sold', 'kept');

-- CreateTable
CREATE TABLE "ListingOutcome" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "outcome" "ListingOutcomeType" NOT NULL,
    "soldPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingOutcome_userId_idx" ON "ListingOutcome"("userId");

-- CreateIndex
CREATE INDEX "ListingOutcome_categoryId_idx" ON "ListingOutcome"("categoryId");

-- CreateIndex
CREATE INDEX "ListingOutcome_outcome_idx" ON "ListingOutcome"("outcome");
