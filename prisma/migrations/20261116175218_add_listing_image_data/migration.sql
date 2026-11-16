-- CreateTable
CREATE TABLE "ListingImageData" (
    "listingImageId" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingImageData_pkey" PRIMARY KEY ("listingImageId")
);

-- AddForeignKey
ALTER TABLE "ListingImageData" ADD CONSTRAINT "ListingImageData_listingImageId_fkey" FOREIGN KEY ("listingImageId") REFERENCES "ListingImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
