/*
  Facet metadata and the all-products facets.

  - Every facet schema gets a `type` (numeric or option) and a `required` flag.
  - Condition is a required facet.
  - "For Sale / Wanted", price and year become generic facets that belong to
    the all-products section. Price and year are numeric; orientation has two
    options. The frontend renders these three questions even if a database has
    no matching rows, so the inserts are best-effort and need at least one
    category to attach the generic facet schemas to.
  - Existing English labels are updated because the description seed is
    insert-only and would otherwise keep the old texts.
*/

-- 1. Facet type and required flag.
CREATE TYPE "FacetType" AS ENUM ('numeric', 'option');

ALTER TABLE "FacetSchema"
ADD COLUMN "type" "FacetType" NOT NULL DEFAULT 'option',
ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT false;

UPDATE "FacetSchema" SET "required" = true WHERE "name" = 'condition';

-- 2. Allocate description ids after the current maximum. The category is the
--    one condition uses (the generic home); without condition, the first
--    category works. A fresh database has no categories yet, so nothing is
--    inserted there.
CREATE TEMP TABLE "_facet_meta_seed" AS
SELECT
    COALESCE((SELECT MAX("id") FROM "Description"), 0) AS max_description_id,
    COALESCE(
        (SELECT "categoryId" FROM "FacetSchema" WHERE "name" = 'condition' ORDER BY "id" LIMIT 1),
        (SELECT "id" FROM "Category" ORDER BY "id" LIMIT 1)
    ) AS category_id;

-- 3. Description for the orientation facet.
INSERT INTO "Description" ("id", "language", "text", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + 1,
    "v"."language",
    "v"."text",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_meta_seed" "b"
CROSS JOIN (
    SELECT 'en' AS "language", 'For Sale / Wanted' AS "text"
    UNION ALL SELECT 'hr', 'Za prodaju / Tražim'
) "v"
WHERE "b"."category_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FacetSchema" WHERE "name" = 'orientation');

-- 3b. Descriptions for the two orientation options. Insert them when the
--     orientation facet has no options yet, even if the facet row itself is
--     already present.
INSERT INTO "Description" ("id", "language", "text", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + "v"."offset",
    "v"."language",
    "v"."text",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_meta_seed" "b"
CROSS JOIN (
    SELECT 4 AS "offset", 'en' AS "language", 'For Sale' AS "text"
    UNION ALL SELECT 4, 'hr', 'Prodaje se'
    UNION ALL SELECT 5, 'en', 'Wanted'
    UNION ALL SELECT 5, 'hr', 'Tražim'
) "v"
WHERE "b"."category_id" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM "FacetValueOption" "o"
      JOIN "FacetSchema" "s" ON "s"."id" = "o"."schemaId"
      WHERE "s"."name" = 'orientation'
  );

-- 4. Descriptions for the numeric price and year facets.
INSERT INTO "Description" ("id", "language", "text", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + 2,
    "v"."language",
    "v"."text",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_meta_seed" "b"
CROSS JOIN (
    SELECT 'en' AS "language", 'Price' AS "text"
    UNION ALL SELECT 'hr', 'Cijena'
) "v"
WHERE "b"."category_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FacetSchema" WHERE "name" = 'price');

INSERT INTO "Description" ("id", "language", "text", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + 3,
    "v"."language",
    "v"."text",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_meta_seed" "b"
CROSS JOIN (
    SELECT 'en' AS "language", 'Year' AS "text"
    UNION ALL SELECT 'hr', 'Godina'
) "v"
WHERE "b"."category_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FacetSchema" WHERE "name" = 'year');

-- 5. The generic facet schemas. Orientation is required; price and year are
--    numeric range questions.
INSERT INTO "FacetSchema" ("descriptionId", "name", "categoryId", "isGeneric", "type", "required", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + 1,
    'orientation',
    "b"."category_id",
    true,
    'option',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_meta_seed" "b"
WHERE "b"."category_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FacetSchema" WHERE "name" = 'orientation');

INSERT INTO "FacetSchema" ("descriptionId", "name", "categoryId", "isGeneric", "type", "required", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + 2,
    'price',
    "b"."category_id",
    true,
    'numeric',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_meta_seed" "b"
WHERE "b"."category_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FacetSchema" WHERE "name" = 'price');

INSERT INTO "FacetSchema" ("descriptionId", "name", "categoryId", "isGeneric", "type", "required", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + 3,
    'year',
    "b"."category_id",
    true,
    'numeric',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_meta_seed" "b"
WHERE "b"."category_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FacetSchema" WHERE "name" = 'year');

-- 6. Orientation options. Their value is the Listing.orientation enum, so the
--    selection table is not used for this facet; the rows keep the API facet
--    complete and make the option labels editable.
INSERT INTO "FacetValueOption" ("descriptionId", "schemaId", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + "v"."offset",
    "s"."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_meta_seed" "b"
JOIN "FacetSchema" "s" ON "s"."name" = 'orientation'
CROSS JOIN (
    SELECT 4 AS "offset"
    UNION ALL SELECT 5
) "v"
WHERE "b"."category_id" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "FacetValueOption" "o" WHERE "o"."schemaId" = "s"."id"
  );

DROP TABLE "_facet_meta_seed";

-- 7. Rename the English direction labels. The seed is insert-only, so these
--    rows would keep the old text on an existing database.
UPDATE "Description" SET "text" = 'Wanted', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" IN ('direction.buy', 'direction.buyAction') AND "language" = 'en';

UPDATE "Description" SET "text" = 'For Sale', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" IN ('direction.sell', 'direction.sellAction') AND "language" = 'en';

UPDATE "Description" SET "text" = 'Wanted listings', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'listings.buyTitle' AND "language" = 'en';

UPDATE "Description" SET "text" = 'For Sale listings', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'listings.sellTitle' AND "language" = 'en';

UPDATE "Description" SET "text" = 'Choose For Sale or Wanted first', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'interview.chooseDirection' AND "language" = 'en';
