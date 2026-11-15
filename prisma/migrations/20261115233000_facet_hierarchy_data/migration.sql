/*
  Facet hierarchy data:
  - generic facets are marked with `isGeneric` (condition applies to all products)
  - brand moves from Mobile phones to its parent Electronics
  - Mobile phones gets a screen_size facet with options

  Existing description ids are preserved; new descriptions are allocated after
  the current maximum so this migration is safe on a populated database.
*/

-- 1. Add the generic flag.
ALTER TABLE "FacetSchema" ADD COLUMN "isGeneric" BOOLEAN NOT NULL DEFAULT false;

-- 2. Condition is a generic product facet (ALL section).
UPDATE "FacetSchema" SET "isGeneric" = true WHERE "name" = 'condition';

-- 3. Brand is defined on Electronics and is inherited by Mobile phones.
UPDATE "FacetSchema" SET "categoryId" = 1 WHERE "name" = 'brand';

-- 4. Add the Mobile phones screen-size facet and its options.
CREATE TEMP TABLE "_facet_seed_base" AS
SELECT COALESCE(MAX("id"), 0) AS max_id FROM "Description";

INSERT INTO "Description" ("id", "language", "text", "createdAt", "updatedAt")
SELECT max_id + 1, 'en', 'Screen size', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 1, 'hr', 'Veličina zaslona', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 2, 'en', 'Under 6″', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 2, 'hr', 'Manje od 6″', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 3, 'en', '6–6.5″', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 3, 'hr', '6–6,5″', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 4, 'en', 'Over 6.5″', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 4, 'hr', 'Više od 6,5″', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base";

INSERT INTO "FacetSchema" ("descriptionId", "name", "categoryId", "isGeneric", "createdAt", "updatedAt")
SELECT max_id + 1, 'screen_size', 2, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_facet_seed_base";

INSERT INTO "FacetValueOption" ("descriptionId", "schemaId", "createdAt", "updatedAt")
SELECT max_id + 2, (SELECT "id" FROM "FacetSchema" WHERE "name" = 'screen_size'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 3, (SELECT "id" FROM "FacetSchema" WHERE "name" = 'screen_size'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base"
UNION ALL
SELECT max_id + 4, (SELECT "id" FROM "FacetSchema" WHERE "name" = 'screen_size'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "_facet_seed_base";

DROP TABLE "_facet_seed_base";
