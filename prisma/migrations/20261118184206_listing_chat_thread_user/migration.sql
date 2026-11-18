-- AlterTable
ALTER TABLE "ListingChatThread" ADD COLUMN     "userId" INTEGER;

-- CreateIndex
CREATE INDEX "ListingChatThread_userId_idx" ON "ListingChatThread"("userId");
