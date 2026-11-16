-- Seed the languages the interface and descriptions use. The API and the
-- frontend rely on both rows existing, so this runs on every fresh database.
INSERT INTO "Language" ("code", "name", "updatedAt") VALUES
    ('en', 'English', CURRENT_TIMESTAMP),
    ('hr', 'Hrvatski', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
