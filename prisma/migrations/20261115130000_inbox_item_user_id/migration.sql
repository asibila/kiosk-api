/*
  Warnings:

  - You are about to drop the column `listId` on the `InboxItem` table. Its user is
    copied from the related `InboxList.userId` before the column is removed.
  - You are about to drop the `InboxList` table. If the table is not empty, all the
    data in it will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InboxItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "chatThreadId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "InboxItem_chatThreadId_fkey" FOREIGN KEY ("chatThreadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InboxItem" ("id", "userId", "chatThreadId", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT "InboxItem"."id", "InboxList"."userId", "InboxItem"."chatThreadId", "InboxItem"."createdAt", "InboxItem"."updatedAt", "InboxItem"."createdBy", "InboxItem"."updatedBy"
FROM "InboxItem"
INNER JOIN "InboxList" ON "InboxList"."id" = "InboxItem"."listId";
DROP TABLE "InboxItem";
ALTER TABLE "new_InboxItem" RENAME TO "InboxItem";
CREATE UNIQUE INDEX "InboxItem_chatThreadId_key" ON "InboxItem"("chatThreadId");
CREATE INDEX "InboxItem_userId_idx" ON "InboxItem"("userId");
DROP TABLE "InboxList";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
