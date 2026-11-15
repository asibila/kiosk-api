-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ListingImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listingId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "primaryImage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "ListingImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ListingImage" ("createdAt", "createdBy", "fileName", "id", "listingId", "mimeType", "size", "updatedAt", "updatedBy") SELECT "createdAt", "createdBy", "fileName", "id", "listingId", "mimeType", "size", "updatedAt", "updatedBy" FROM "ListingImage";
DROP TABLE "ListingImage";
ALTER TABLE "new_ListingImage" RENAME TO "ListingImage";
CREATE UNIQUE INDEX "ListingImage_fileName_key" ON "ListingImage"("fileName");
CREATE INDEX "ListingImage_listingId_idx" ON "ListingImage"("listingId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
