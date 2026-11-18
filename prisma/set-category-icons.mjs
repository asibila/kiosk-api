// Give existing categories an inline SVG icon, matched by their English name.
//
// Categories are user data, so this is a one-off, idempotent backfill rather
// than part of the schema migration: rows that already have an icon are left
// alone unless `--force` is passed. The icons live in `category-icons.json`
// and are validated against the API sanitizer by `category-icon.spec.ts`.
//
//   node prisma/set-category-icons.mjs           # fill empty icons
//   node prisma/set-category-icons.mjs --force   # re-apply the defaults
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const force = process.argv.includes('--force');
const icons = JSON.parse(
  readFileSync(new URL('./category-icons.json', import.meta.url), 'utf8'),
);

try {
  const categories = await prisma.category.findMany({
    select: { id: true, iconSvg: true, descriptionId: true },
    orderBy: { id: 'asc' },
  });
  const descriptions = await prisma.description.findMany({
    where: { language: 'en', name: null },
    select: { id: true, text: true },
  });
  const titleById = new Map(descriptions.map((row) => [row.id, row.text]));

  let updated = 0;
  let skipped = 0;

  for (const category of categories) {
    const title = (titleById.get(category.descriptionId) ?? '').trim().toLowerCase();
    const icon = icons[title];
    if (!icon) continue;

    if (category.iconSvg != null && !force) {
      skipped += 1;
      continue;
    }

    await prisma.category.update({
      where: { id: category.id },
      data: { iconSvg: icon },
    });
    updated += 1;
  }

  console.log(
    `Category icons: ${updated} updated, ${skipped} kept` +
      (force ? ' (--force)' : ''),
  );
} finally {
  await prisma.$disconnect();
}
