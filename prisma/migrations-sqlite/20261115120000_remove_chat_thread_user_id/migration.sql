/*
  Warnings:

  - You are about to drop the column `userId` on the `ChatThread` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatThread" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER
);
INSERT INTO "new_ChatThread" ("id", "createdAt", "updatedAt", "createdBy", "updatedBy") SELECT "id", "createdAt", "updatedAt", "createdBy", "updatedBy" FROM "ChatThread";
DROP TABLE "ChatThread";
ALTER TABLE "new_ChatThread" RENAME TO "ChatThread";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
