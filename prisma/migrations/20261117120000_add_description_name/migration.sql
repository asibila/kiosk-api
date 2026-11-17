-- Add the i18n key that links a Description to a React translation key. It is
-- null for entity descriptions (categories, facets) and set for UI strings.
ALTER TABLE "Description" ADD COLUMN "name" TEXT;

-- One key may exist once per language, so `(name, language)` is unique. Rows
-- with a null name (entity descriptions) are unaffected by the unique index.
CREATE UNIQUE INDEX "Description_name_language_key" ON "Description"("name", "language");
