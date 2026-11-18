-- `ListingChatThread.userId` becomes the mandatory initiator of the contact and
-- a user may have at most one conversation per listing.
--
-- Existing rows are resolved in order of trust: the thread creator, then the
-- inbox row that belongs to the initiator. A link that still has no known
-- initiator cannot satisfy the constraint, so it is dropped; its chat thread
-- stays in the participant's inbox untouched.

UPDATE "ListingChatThread" AS lct
SET "userId" = ct."createdBy"
FROM "ChatThread" AS ct
WHERE lct."chatThreadId" = ct."id"
  AND lct."userId" IS NULL
  AND ct."createdBy" IS NOT NULL;

UPDATE "ListingChatThread" AS lct
SET "userId" = ii."userId"
FROM "InboxItem" AS ii
WHERE lct."chatThreadId" = ii."chatThreadId"
  AND lct."userId" IS NULL;

DELETE FROM "ListingChatThread"
WHERE "userId" IS NULL;

-- Keep the earliest link of every (user, listing) pair before the unique index
-- goes in. Extra links are dropped; their threads stay in the inbox.
DELETE FROM "ListingChatThread" AS lct
USING "ListingChatThread" AS keep
WHERE lct."userId" = keep."userId"
  AND lct."listingId" = keep."listingId"
  AND lct."id" > keep."id";

ALTER TABLE "ListingChatThread" ALTER COLUMN "userId" SET NOT NULL;

CREATE UNIQUE INDEX "ListingChatThread_userId_listingId_key" ON "ListingChatThread"("userId", "listingId");

-- The composite unique index already covers lookups by `userId` alone.
DROP INDEX IF EXISTS "ListingChatThread_userId_idx";
