/*
  Facet hierarchy data:
  - generic facets are marked with `isGeneric` (condition applies to all products)
  - brand moves from Mobile phones to its parent Electronics
  - Mobile phones gets a screen_size facet with options

  Existing description ids are preserved; new descriptions are allocated after
  the current maximum so this migration is safe on a populated database.

  Category ids are not fixed: categories are created through the API, and a
  fresh database has none yet. The seed therefore looks categories up by their
  English description and only touches data that exists.
*/

-- 1. Add the generic flag.
ALTER TABLE "FacetSchema" ADD COLUMN "isGeneric" BOOLEAN NOT NULL DEFAULT false;

-- 2. Condition is a generic product facet (ALL section).
UPDATE "FacetSchema" SET "isGeneric" = true WHERE "name" = 'condition';

-- 3. Brand is defined on Electronics and is inherited by Mobile phones.
UPDATE "FacetSchema"
SET "categoryId" = (
    SELECT "c"."id"
    FROM "Category" "c"
    JOIN "Description" "d" ON "d"."id" = "c"."descriptionId"
    WHERE "d"."language" = 'en' AND "d"."text" = 'Electronics'
    ORDER BY "c"."id"
    LIMIT 1
)
WHERE "name" = 'brand'
  AND EXISTS (
      SELECT 1
      FROM "Category" "c"
      JOIN "Description" "d" ON "d"."id" = "c"."descriptionId"
      WHERE "d"."language" = 'en' AND "d"."text" = 'Electronics'
  );

-- 4. Add the Mobile phones screen-size facet and its options.
CREATE TEMP TABLE "_facet_seed_base" AS
SELECT
    COALESCE(MAX("id"), 0) AS max_id,
    (
        SELECT "c"."id"
        FROM "Category" "c"
        JOIN "Description" "d" ON "d"."id" = "c"."descriptionId"
        WHERE "d"."language" = 'en' AND "d"."text" = 'Mobile phones'
        ORDER BY "c"."id"
        LIMIT 1
    ) AS mobile_phones_id
FROM "Description";

INSERT INTO "Description" ("id", "language", "text", "createdAt", "updatedAt")
SELECT
    "b"."max_id" + "v"."offset",
    "v"."language",
    "v"."text",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_seed_base" "b"
CROSS JOIN (
    SELECT 1 AS "offset", 'en' AS "language", 'Screen size' AS "text"
    UNION ALL SELECT 1, 'hr', 'Veličina zaslona'
    UNION ALL SELECT 2, 'en', 'Under 6″'
    UNION ALL SELECT 2, 'hr', 'Manje od 6″'
    UNION ALL SELECT 3, 'en', '6–6.5″'
    UNION ALL SELECT 3, 'hr', '6–6,5″'
    UNION ALL SELECT 4, 'en', 'Over 6.5″'
    UNION ALL SELECT 4, 'hr', 'Više od 6,5″'
) "v"
WHERE "b"."mobile_phones_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FacetSchema" WHERE "name" = 'screen_size');

INSERT INTO "FacetSchema" ("descriptionId", "name", "categoryId", "isGeneric", "createdAt", "updatedAt")
SELECT
    "b"."max_id" + 1,
    'screen_size',
    "b"."mobile_phones_id",
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_seed_base" "b"
WHERE "b"."mobile_phones_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FacetSchema" WHERE "name" = 'screen_size');

INSERT INTO "FacetValueOption" ("descriptionId", "schemaId", "createdAt", "updatedAt")
SELECT
    "b"."max_id" + "v"."offset",
    "s"."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_facet_seed_base" "b"
JOIN "FacetSchema" "s" ON "s"."name" = 'screen_size'
CROSS JOIN (
    SELECT 2 AS "offset"
    UNION ALL SELECT 3
    UNION ALL SELECT 4
) "v"
WHERE "b"."mobile_phones_id" IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM "Description" "d"
      WHERE "d"."id" = "b"."max_id" + 2 AND "d"."language" = 'en'
  )
  AND NOT EXISTS (
      SELECT 1 FROM "FacetValueOption" "o" WHERE "o"."schemaId" = "s"."id"
  );

DROP TABLE "_facet_seed_base";
