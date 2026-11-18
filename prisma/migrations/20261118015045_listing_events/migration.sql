-- CreateEnum
CREATE TYPE "ListingEventType" AS ENUM ('view', 'contact', 'share');

-- CreateTable
CREATE TABLE "ListingEvent" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "type" "ListingEventType" NOT NULL DEFAULT 'view',
    "visitorId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingEvent_listingId_day_idx" ON "ListingEvent"("listingId", "day");

-- CreateIndex
CREATE INDEX "ListingEvent_day_idx" ON "ListingEvent"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ListingEvent_listingId_type_visitorId_day_key" ON "ListingEvent"("listingId", "type", "visitorId", "day");

-- AddForeignKey
ALTER TABLE "ListingEvent" ADD CONSTRAINT "ListingEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
