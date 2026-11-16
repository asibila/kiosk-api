-- Listing drafts and per-language titles.
--
-- Existing listings stay active; new listings are created inactive when the
-- interview's Next button opens the edit step and are activated on Publish.
-- Titles live in their own table (not the shared Description catalog) because
-- they belong 1:1 to a listing and should cascade with it.

ALTER TABLE "Listing" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ListingTranslation" (
    "listingId" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "ListingTranslation_pkey" PRIMARY KEY ("listingId", "language"),
    CONSTRAINT "ListingTranslation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingTranslation_language_fkey" FOREIGN KEY ("language") REFERENCES "Language" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ListingTranslation_language_idx" ON "ListingTranslation"("language");
