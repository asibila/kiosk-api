-- CreateTable
CREATE TABLE "Listing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "orientation" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "Listing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descriptionId" INTEGER NOT NULL,
    "parentCategoryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "Category_descriptionId_fkey" FOREIGN KEY ("descriptionId") REFERENCES "Description" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Description" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "threadId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER
);

-- CreateTable
CREATE TABLE "InboxList" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER
);

-- CreateTable
CREATE TABLE "ListingChatThread" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listingId" INTEGER NOT NULL,
    "chatThreadId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "ListingChatThread_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingChatThread_chatThreadId_fkey" FOREIGN KEY ("chatThreadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "listId" INTEGER NOT NULL,
    "chatThreadId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "InboxItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "InboxList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InboxItem_chatThreadId_fkey" FOREIGN KEY ("chatThreadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FacetSchema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descriptionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "FacetSchema_descriptionId_fkey" FOREIGN KEY ("descriptionId") REFERENCES "Description" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FacetSchema_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FacetValueOption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descriptionId" INTEGER NOT NULL,
    "schemaId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "FacetValueOption_descriptionId_fkey" FOREIGN KEY ("descriptionId") REFERENCES "Description" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FacetValueOption_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "FacetSchema" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FacetValueSelection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "facetValueOptionId" INTEGER NOT NULL,
    "listingId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "FacetValueSelection_facetValueOptionId_fkey" FOREIGN KEY ("facetValueOptionId") REFERENCES "FacetValueOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FacetValueSelection_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Listing_categoryId_idx" ON "Listing"("categoryId");

-- CreateIndex
CREATE INDEX "Listing_userId_idx" ON "Listing"("userId");

-- CreateIndex
CREATE INDEX "Category_descriptionId_idx" ON "Category"("descriptionId");

-- CreateIndex
CREATE INDEX "Category_parentCategoryId_idx" ON "Category"("parentCategoryId");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_idx" ON "ChatMessage"("threadId");

-- CreateIndex
CREATE INDEX "ChatThread_userId_idx" ON "ChatThread"("userId");

-- CreateIndex
CREATE INDEX "InboxList_userId_idx" ON "InboxList"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingChatThread_chatThreadId_key" ON "ListingChatThread"("chatThreadId");

-- CreateIndex
CREATE INDEX "ListingChatThread_listingId_idx" ON "ListingChatThread"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "InboxItem_chatThreadId_key" ON "InboxItem"("chatThreadId");

-- CreateIndex
CREATE INDEX "InboxItem_listId_idx" ON "InboxItem"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "FacetSchema_name_key" ON "FacetSchema"("name");

-- CreateIndex
CREATE INDEX "FacetSchema_descriptionId_idx" ON "FacetSchema"("descriptionId");

-- CreateIndex
CREATE INDEX "FacetSchema_categoryId_idx" ON "FacetSchema"("categoryId");

-- CreateIndex
CREATE INDEX "FacetValueOption_descriptionId_idx" ON "FacetValueOption"("descriptionId");

-- CreateIndex
CREATE INDEX "FacetValueOption_schemaId_idx" ON "FacetValueOption"("schemaId");

-- CreateIndex
CREATE INDEX "FacetValueSelection_facetValueOptionId_idx" ON "FacetValueSelection"("facetValueOptionId");

-- CreateIndex
CREATE INDEX "FacetValueSelection_listingId_idx" ON "FacetValueSelection"("listingId");
