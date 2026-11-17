// Insert the interface descriptions that used to be hardcoded in the frontend.
// The seed is insert-only: once a key exists, its text is owned by the database
// and is not overwritten on later deploys. New keys are added on the next run.
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seed = JSON.parse(
  readFileSync(new URL('./descriptions.seed.json', import.meta.url), 'utf8'),
);

try {
  const languages = await prisma.language.findMany({
    select: { code: true },
    orderBy: { code: 'asc' },
  });
  const codes = languages.map((language) => language.code);

  if (codes.length === 0) {
    throw new Error('No languages configured; seed the Language table first');
  }

  const existing = await prisma.description.findMany({
    where: { name: { not: null } },
    select: { id: true, name: true },
  });
  const idByName = new Map();
  for (const row of existing) {
    if (row.name != null && !idByName.has(row.name)) {
      idByName.set(row.name, row.id);
    }
  }

  const last = await prisma.description.aggregate({ _max: { id: true } });
  let nextId = (last._max.id ?? 0) + 1;

  const rows = [];
  for (const [name, translations] of Object.entries(seed)) {
    const missing = codes.filter((code) => !translations[code]);
    if (missing.length > 0) {
      throw new Error(`${name}: missing translations for ${missing.join(', ')}`);
    }

    const id = idByName.get(name) ?? nextId++;
    for (const language of codes) {
      rows.push({ id, language, name, text: translations[language] });
    }
  }

  const result = await prisma.description.createMany({
    data: rows,
    skipDuplicates: true,
  });

  console.log(
    `Seeded ${result.count} description rows (${Object.keys(seed).length} keys, ${codes.join(', ')})`,
  );
} finally {
  await prisma.$disconnect();
}
