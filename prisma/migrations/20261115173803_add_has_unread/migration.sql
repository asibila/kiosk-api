-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InboxItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "chatThreadId" INTEGER NOT NULL,
    "hasUnread" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "InboxItem_chatThreadId_fkey" FOREIGN KEY ("chatThreadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InboxItem" ("chatThreadId", "createdAt", "createdBy", "id", "updatedAt", "updatedBy", "userId") SELECT "chatThreadId", "createdAt", "createdBy", "id", "updatedAt", "updatedBy", "userId" FROM "InboxItem";
DROP TABLE "InboxItem";
ALTER TABLE "new_InboxItem" RENAME TO "InboxItem";
CREATE UNIQUE INDEX "InboxItem_chatThreadId_key" ON "InboxItem"("chatThreadId");
CREATE INDEX "InboxItem_userId_idx" ON "InboxItem"("userId");
CREATE TABLE "new_ListingChatThread" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listingId" INTEGER NOT NULL,
    "chatThreadId" INTEGER NOT NULL,
    "hasUnread" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "ListingChatThread_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingChatThread_chatThreadId_fkey" FOREIGN KEY ("chatThreadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ListingChatThread" ("chatThreadId", "createdAt", "createdBy", "id", "listingId", "updatedAt", "updatedBy") SELECT "chatThreadId", "createdAt", "createdBy", "id", "listingId", "updatedAt", "updatedBy" FROM "ListingChatThread";
DROP TABLE "ListingChatThread";
ALTER TABLE "new_ListingChatThread" RENAME TO "ListingChatThread";
CREATE UNIQUE INDEX "ListingChatThread_chatThreadId_key" ON "ListingChatThread"("chatThreadId");
CREATE INDEX "ListingChatThread_listingId_idx" ON "ListingChatThread"("listingId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
