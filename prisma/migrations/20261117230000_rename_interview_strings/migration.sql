/*
  "Session" (the per-category interview screen) was renamed to "interview".

  The frontend now asks for `interview.*` keys; the old `session.*` rows are
  left in place so a cached bundle keeps working. The seed is insert-only, so a
  deployed database needs these new keys from a migration. `loading.title` is
  updated in place because its visible text mentioned sessions.
*/

CREATE TEMP TABLE "_interview_strings" (
    "ord" INTEGER PRIMARY KEY,
    "name" TEXT NOT NULL,
    "en" TEXT NOT NULL,
    "hr" TEXT NOT NULL
);

INSERT INTO "_interview_strings" ("ord", "name", "en", "hr") VALUES
    (1, 'interview.aria', '{title} interview', '{title} intervju'),
    (2, 'interview.questionsAnswered', 'Questions answered', 'Odgovorena pitanja'),
    (3, 'interview.answered', '{answered} / {total} answered', '{answered} / {total} odgovoreno'),
    (4, 'interview.empty', 'This category has no interview questions yet. Facet schemas added to it in the backend will appear here.', 'Ova kategorija još nema pitanja za intervju. Značajke dodane na poslužitelju pojavit će se ovdje.'),
    (5, 'interview.answeredTitle', 'Answered', 'Odgovoreno');

CREATE TEMP TABLE "_interview_base" AS
SELECT COALESCE(MAX("id"), 0) AS "max_description_id" FROM "Description";

INSERT INTO "Description" ("id", "language", "name", "text", "createdAt", "updatedAt")
SELECT
    "b"."max_description_id" + "s"."ord",
    "v"."language",
    "s"."name",
    "v"."text",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "_interview_strings" "s"
CROSS JOIN "_interview_base" "b"
CROSS JOIN LATERAL (
    VALUES ('en', "s"."en"), ('hr', "s"."hr")
) AS "v" ("language", "text")
WHERE NOT EXISTS (
    SELECT 1
    FROM "Description" "d"
    WHERE "d"."name" = "s"."name" AND "d"."language" = "v"."language"
);

UPDATE "Description"
SET "text" = 'Loading interviews…', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'loading.title' AND "language" = 'en';

UPDATE "Description"
SET "text" = 'Učitavanje intervjua…', "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'loading.title' AND "language" = 'hr';

DROP TABLE "_interview_strings";
DROP TABLE "_interview_base";
