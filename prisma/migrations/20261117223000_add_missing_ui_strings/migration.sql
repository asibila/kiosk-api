/*
  Interface strings added after a deployed database last ran the seed.

  `prisma/seed.mjs` is insert-only and runs from `start:prod`. A deployment that
  applies migrations without running the seed (for example a separate release
  command) never gets the new keys, so the frontend renders the raw key
  ("search.regionTitle"). Shipping the texts as a migration makes them part of
  the schema history; `NOT EXISTS` keeps this a no-op where the seed already
  created them.

  Keep this list in sync with the keys added since the previous seed run:
  topbar add/sign-in and the region title/picker strings, plus the facet and
  interview strings introduced by the earlier facet work.
*/

CREATE TEMP TABLE "_ui_strings" (
    "ord" INTEGER PRIMARY KEY,
    "name" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "hr" TEXT NOT NULL
);

INSERT INTO "_ui_strings" ("ord", "name", "en", "hr") VALUES
    (1,  'topbar.addListing', 'Add listing', 'Dodaj oglas'),
    (2,  'topbar.signInToPublish', 'Please sign in to publish', 'Prijavite se da objavite oglas'),
    (3,  'topbar.signInToPublishBody', 'You need to be signed in to create a listing.', 'Morate biti prijavljeni da biste kreirali oglas.'),
    (4,  'search.regionTitle', 'Search {region}', 'Pretraga: {region}'),
    (5,  'search.allRegionsTitle', 'Search all regions', 'Pretraga svih regija'),
    (6,  'region.choose', 'Choose region', 'Odaberite regiju'),
    (7,  'region.all', 'All regions', 'Sve regije'),
    (8,  'facet.orientation', 'For Sale / Wanted', 'Za prodaju / Tražim'),
    (9,  'interview.required', 'Required', 'Obavezno'),
    (10, 'interview.requiredMissing', 'Answer the required questions to continue.', 'Odgovori na obavezna pitanja za nastavak.');

CREATE TEMP TABLE "_ui_base" AS
SELECT COALESCE(MAX("id"), 0) AS "max_description_id" FROM "Description";

-- One new description id per key (ordered by ord), with a row per language.
-- Existing keys keep their current texts and ids.
INSERT INTO "Description" ("id", "language", "name", "text", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + "s"."ord",
    "v"."language",
    "s"."name",
    "v"."text",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_ui_strings" "s"
CROSS JOIN "_ui_base" "b"
CROSS JOIN LATERAL (
    VALUES ('en', "s"."en"), ('hr', "s"."hr")
) AS "v" ("language", "text")
WHERE NOT EXISTS (
    SELECT 1
    FROM "Description" "d"
    WHERE "d"."name" = "s"."name" AND "d"."language" = "v"."language"
);

DROP TABLE "_ui_strings";
DROP TABLE "_ui_base";
