/*
  Existing listings predate the region feature and all belong to Croatia.

  Only rows still on the global row (regionId = 0) are touched; a listing that
  already has a real region keeps it. The EXISTS guard keeps the migration a
  no-op on a database where the region seed is missing.
*/

UPDATE "Listing"
SET "regionId" = (
    SELECT "id" FROM "Region" WHERE "code" = 'HR'
)
WHERE "regionId" = 0
  AND EXISTS (SELECT 1 FROM "Region" WHERE "code" = 'HR');
