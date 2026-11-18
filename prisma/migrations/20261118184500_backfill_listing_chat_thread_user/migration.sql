-- Existing listing chat links predate `userId`; the thread creator is the user
-- who initiated the contact, which is what the owner-side conversation list
-- groups on.
UPDATE "ListingChatThread" AS lct
SET "userId" = ct."createdBy"
FROM "ChatThread" AS ct
WHERE lct."chatThreadId" = ct."id"
  AND lct."userId" IS NULL
  AND ct."createdBy" IS NOT NULL;
