/*
  Regions: every listing carries the region it is published in.

  - `Region` holds one row per country (ISO 3166-1 alpha-2 `code`), with a
    translated name stored like category texts: two `Description` rows with no
    i18n `name`, one per language.
  - Id 0 is the "All regions" row. It is used when the visitor's country cannot
    be detected from the IP address and when the search covers the whole
    database.
  - The seed covers the EU member states plus the ex-Yugoslav countries outside
    the EU: Bosnia and Herzegovina, Serbia and Montenegro.
  - Existing listings get `regionId = 0` (no specific region).
*/

-- 1. Region table.
CREATE TABLE "Region" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "descriptionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");
CREATE INDEX "Region_descriptionId_idx" ON "Region"("descriptionId");

-- 2. Seed data. The temporary tables keep the allocation stable across the two
--    inserts even when this migration is replayed on a copy.
CREATE TEMP TABLE "_region_seed" (
    "ord" INTEGER PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_hr" TEXT NOT NULL
);

INSERT INTO "_region_seed" ("ord", "code", "name_en", "name_hr") VALUES
    (0,  'ALL', 'All regions',              'Sve regije'),
    (1,  'AT',  'Austria',                  'Austrija'),
    (2,  'BE',  'Belgium',                  'Belgija'),
    (3,  'BG',  'Bulgaria',                 'Bugarska'),
    (4,  'HR',  'Croatia',                  'Hrvatska'),
    (5,  'CY',  'Cyprus',                   'Cipar'),
    (6,  'CZ',  'Czechia',                  'Češka'),
    (7,  'DK',  'Denmark',                  'Danska'),
    (8,  'EE',  'Estonia',                  'Estonija'),
    (9,  'FI',  'Finland',                  'Finska'),
    (10, 'FR',  'France',                   'Francuska'),
    (11, 'DE',  'Germany',                  'Njemačka'),
    (12, 'GR',  'Greece',                   'Grčka'),
    (13, 'HU',  'Hungary',                  'Mađarska'),
    (14, 'IE',  'Ireland',                  'Irska'),
    (15, 'IT',  'Italy',                    'Italija'),
    (16, 'LV',  'Latvia',                   'Latvija'),
    (17, 'LT',  'Lithuania',                'Litva'),
    (18, 'LU',  'Luxembourg',               'Luksemburg'),
    (19, 'MT',  'Malta',                    'Malta'),
    (20, 'NL',  'Netherlands',              'Nizozemska'),
    (21, 'PL',  'Poland',                   'Poljska'),
    (22, 'PT',  'Portugal',                 'Portugal'),
    (23, 'RO',  'Romania',                  'Rumunjska'),
    (24, 'SK',  'Slovakia',                 'Slovačka'),
    (25, 'SI',  'Slovenia',                 'Slovenija'),
    (26, 'ES',  'Spain',                    'Španjolska'),
    (27, 'SE',  'Sweden',                   'Švedska'),
    (28, 'BA',  'Bosnia and Herzegovina',   'Bosna i Hercegovina'),
    (29, 'RS',  'Serbia',                   'Srbija'),
    (30, 'ME',  'Montenegro',               'Crna Gora');

CREATE TEMP TABLE "_region_base" AS
SELECT COALESCE(MAX("id"), 0) AS "max_description_id" FROM "Description";

-- Region names are ordinary descriptions (no i18n `name`), two rows each.
INSERT INTO "Description" ("id", "language", "text", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + "s"."ord" + 1,
    "v"."language",
    "v"."text",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_region_seed" "s"
CROSS JOIN "_region_base" "b"
CROSS JOIN LATERAL (
    VALUES ('en', "s"."name_en"), ('hr', "s"."name_hr")
) AS "v" ("language", "text")
WHERE NOT EXISTS (SELECT 1 FROM "Region");

INSERT INTO "Region" ("id", "code", "descriptionId", "createdAt", "updatedAt")
SELECT
    "s"."ord",
    "s"."code",
    "b"."max_description_id" + "s"."ord" + 1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_region_seed" "s"
CROSS JOIN "_region_base" "b"
WHERE NOT EXISTS (SELECT 1 FROM "Region");

-- Explicit ids do not advance the SERIAL sequence; move it past them.
SELECT setval(
    pg_get_serial_sequence('"Region"', 'id'),
    (SELECT COALESCE(MAX("id"), 0) FROM "Region")
);

DROP TABLE "_region_seed";
DROP TABLE "_region_base";

-- 3. Tag every listing with a region. Existing rows stay global (0).
ALTER TABLE "Listing" ADD COLUMN "regionId" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Listing_regionId_idx" ON "Listing"("regionId");

ALTER TABLE "Listing" ADD CONSTRAINT "Listing_regionId_fkey"
    FOREIGN KEY ("regionId") REFERENCES "Region"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
