// One-time (and safe-to-rerun) migration: loads the former hardcoded brand
// catalog (brands-data.ts) into the `catalog_items` table under themeId
// "brands", and seeds the `themes` table with the 4 planned themes (only
// "brands" enabled — the other 3 stay disabled until their own seed
// scripts populate real content). Run with DATABASE_URL pointed at the
// target database: `pnpm --filter @workspace/scripts run seed-brands`.
import { db, pool, themesTable, catalogItemsTable, makeCatalogItemId } from "@workspace/db";
import { allBrands } from "./brands-data";

const brandsTheme = { id: "brands", nameFr: "Marques", nameEn: "Brands", imageProvider: "brandfetch", aspectW: 1, aspectH: 1, enabled: true, sortOrder: 0 };

// Placeholder rows for the 3 planned themes — inserted once so they exist
// (and so `GET /game/themes` / the admin UI can reference them) but never
// overwritten here: each theme's own seed script (seed-football-clubs.ts,
// seed-movies.ts, seed-video-games.ts) owns its row's `enabled` flag from
// then on. Re-running this script must never silently re-disable a theme
// another script already turned on.
const placeholderThemes = [
  { id: "football-clubs", nameFr: "Clubs de foot", nameEn: "Football clubs", imageProvider: "football-data", aspectW: 1, aspectH: 1, enabled: false, sortOrder: 1 },
  { id: "movies", nameFr: "Affiches de films", nameEn: "Movie posters", imageProvider: "tmdb", aspectW: 2, aspectH: 3, enabled: false, sortOrder: 2 },
  { id: "video-games", nameFr: "Jeux vidéo", nameEn: "Video games", imageProvider: "rawg", aspectW: 3, aspectH: 4, enabled: false, sortOrder: 3 },
];

async function main() {
  console.log(`Seeding ${allBrands.length} brand catalog items...`);

  await db.insert(themesTable).values(brandsTheme).onConflictDoUpdate({ target: themesTable.id, set: brandsTheme });
  for (const theme of placeholderThemes) {
    await db.insert(themesTable).values(theme).onConflictDoNothing({ target: themesTable.id });
  }

  const rows = allBrands.map((brand) => ({
    id: makeCatalogItemId("brands", brand.id),
    themeId: "brands",
    answerFr: brand.answer,
    answerEn: brand.answer,
    aliasesFr: brand.aliases,
    aliasesEn: brand.aliases,
    difficulty: brand.difficulty,
    category: brand.category,
    imageRef: brand.domain,
    active: true,
  }));

  for (const row of rows) {
    await db
      .insert(catalogItemsTable)
      .values(row)
      .onConflictDoUpdate({ target: catalogItemsTable.id, set: { ...row, updatedAt: new Date() } });
  }

  console.log(`Done. ${rows.length} brand catalog items upserted.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
