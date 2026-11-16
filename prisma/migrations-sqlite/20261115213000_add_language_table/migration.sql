/*
  Adds the Language table, makes Description a composite `(id, language)` table
  and fills in the missing translation for every existing description.

  Category/FacetSchema/FacetValueOption keep their `descriptionId` column but no
  longer declare a foreign key to Description: with `(id, language)` as the
  primary key a single `id` is no longer unique, so the relation is resolved by
  the API at read time (and checked when a description is deleted).
*/

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- CreateTable + seed the two supported languages.
CREATE TABLE "Language" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER
);

INSERT INTO "Language" ("code", "name", "updatedAt") VALUES
    ('en', 'English', CURRENT_TIMESTAMP),
    ('hr', 'Hrvatski', CURRENT_TIMESTAMP);

-- RedefineTables: Description with the composite primary key.
CREATE TABLE "new_Description" (
    "id" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    PRIMARY KEY ("id", "language"),
    CONSTRAINT "Description_language_fkey" FOREIGN KEY ("language") REFERENCES "Language" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Description" ("id", "language", "text", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT "id", "language", "text", "createdAt", "updatedAt", "createdBy", "updatedBy" FROM "Description";

-- Add the Croatian text for every English description that has none yet.
INSERT INTO "new_Description" ("id", "language", "text", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT
    d."id",
    'hr',
    CASE d."text"
        WHEN 'Electronics' THEN 'Elektronika'
        WHEN 'Mobile phones' THEN 'Mobiteli'
        WHEN 'Vehicles' THEN 'Vozila'
        WHEN 'Condition' THEN 'Stanje'
        WHEN 'Brand' THEN 'Marka'
        WHEN 'Fuel' THEN 'Gorivo'
        WHEN 'New' THEN 'Novo'
        WHEN 'Used' THEN 'Rabljeno'
        WHEN 'Apple' THEN 'Apple'
        WHEN 'Samsung' THEN 'Samsung'
        WHEN 'Petrol' THEN 'Benzin'
        WHEN 'Diesel' THEN 'Dizel'
        WHEN 'Bikes' THEN 'Bicikli'
        WHEN 'Frame size' THEN 'Veličina okvira'
        WHEN 'Frame material' THEN 'Materijal okvira'
        WHEN 'Aluminum' THEN 'Aluminij'
        WHEN 'Carbon fiber' THEN 'Karbonska vlakna'
        WHEN 'Steel' THEN 'Čelik'
        WHEN 'Titanium' THEN 'Titanij'
        ELSE d."text"
    END,
    d."createdAt",
    d."updatedAt",
    d."createdBy",
    d."updatedBy"
FROM "Description" d
WHERE d."language" = 'en'
  AND NOT EXISTS (
      SELECT 1 FROM "new_Description" n
      WHERE n."id" = d."id" AND n."language" = 'hr'
  );

-- Add the English text for every Croatian description that has none yet.
INSERT INTO "new_Description" ("id", "language", "text", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT
    d."id",
    'en',
    CASE d."text"
        WHEN 'Namještaj' THEN 'Furniture'
        ELSE d."text"
    END,
    d."createdAt",
    d."updatedAt",
    d."createdBy",
    d."updatedBy"
FROM "Description" d
WHERE d."language" = 'hr'
  AND NOT EXISTS (
      SELECT 1 FROM "new_Description" n
      WHERE n."id" = d."id" AND n."language" = 'en'
  );

DROP TABLE "Description";
ALTER TABLE "new_Description" RENAME TO "Description";
CREATE INDEX "Description_language_idx" ON "Description"("language");

-- RedefineTables: Category without the Description foreign key.
CREATE TABLE "new_Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descriptionId" INTEGER NOT NULL,
    "parentCategoryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "Category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("id", "descriptionId", "parentCategoryId", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT "id", "descriptionId", "parentCategoryId", "createdAt", "updatedAt", "createdBy", "updatedBy" FROM "Category";

-- RedefineTables: FacetSchema without the Description foreign key.
CREATE TABLE "new_FacetSchema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descriptionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "FacetSchema_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FacetSchema" ("id", "descriptionId", "name", "categoryId", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT "id", "descriptionId", "name", "categoryId", "createdAt", "updatedAt", "createdBy", "updatedBy" FROM "FacetSchema";

-- RedefineTables: FacetValueOption without the Description foreign key.
CREATE TABLE "new_FacetValueOption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descriptionId" INTEGER NOT NULL,
    "schemaId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    CONSTRAINT "FacetValueOption_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "FacetSchema" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FacetValueOption" ("id", "descriptionId", "schemaId", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT "id", "descriptionId", "schemaId", "createdAt", "updatedAt", "createdBy", "updatedBy" FROM "FacetValueOption";

DROP TABLE "FacetValueOption";
DROP TABLE "FacetSchema";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
ALTER TABLE "new_FacetSchema" RENAME TO "FacetSchema";
ALTER TABLE "new_FacetValueOption" RENAME TO "FacetValueOption";

CREATE INDEX "Category_descriptionId_idx" ON "Category"("descriptionId");
CREATE INDEX "Category_parentCategoryId_idx" ON "Category"("parentCategoryId");
CREATE UNIQUE INDEX "FacetSchema_name_key" ON "FacetSchema"("name");
CREATE INDEX "FacetSchema_descriptionId_idx" ON "FacetSchema"("descriptionId");
CREATE INDEX "FacetSchema_categoryId_idx" ON "FacetSchema"("categoryId");
CREATE INDEX "FacetValueOption_descriptionId_idx" ON "FacetValueOption"("descriptionId");
CREATE INDEX "FacetValueOption_schemaId_idx" ON "FacetValueOption"("schemaId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
