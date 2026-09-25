// One-time (and safe-to-rerun) migration: loads the former hardcoded brand
// catalog (brands-data.ts) into the `catalog_items` table under themeId
// "brands", and seeds the `themes` table with the 4 planned themes (only
// "brands" enabled — the other 3 stay disabled until their own seed
// scripts populate real content). Run with DATABASE_URL pointed at the
// target database: `pnpm --filter @workspace/scripts run seed-brands`.
import { db, pool, themesTable, catalogItemsTable, makeCatalogItemId, type NewTheme, type NewCatalogItem } from "@workspace/db";
import { allBrands } from "./brands-data";

export const brandsTheme: NewTheme = { id: "brands", nameFr: "Marques", nameEn: "Brands", imageProvider: "brandfetch", aspectW: 1, aspectH: 1, enabled: true, sortOrder: 0 };

// Placeholder rows for the 3 planned themes — inserted once so they exist
// (and so `GET /game/themes` / the admin UI can reference them) but never
// overwritten here: each theme's own seed script (seed-football-clubs.ts,
// seed-movies.ts, seed-video-games.ts) owns its row's `enabled` flag from
// then on. Re-running this script must never silently re-disable a theme
// another script already turned on.
export const placeholderThemes: NewTheme[] = [
  { id: "football-clubs", nameFr: "Clubs de foot", nameEn: "Football clubs", imageProvider: "football-data", aspectW: 1, aspectH: 1, enabled: false, sortOrder: 1 },
  { id: "movies", nameFr: "Affiches de films", nameEn: "Movie posters", imageProvider: "tmdb", aspectW: 2, aspectH: 3, enabled: false, sortOrder: 2 },
  { id: "video-games", nameFr: "Jeux vidéo", nameEn: "Video games", imageProvider: "rawg", aspectW: 3, aspectH: 4, enabled: false, sortOrder: 3 },
];

// Pure fetch/transform, no DB access — reused by main() below (writes
// straight to the DB) and by push-remote.ts (writes via the admin HTTP API
// when direct DB access isn't available, e.g. from a sandboxed session).
export function buildBrandsCatalog(): { theme: NewTheme; rows: NewCatalogItem[] } {
  const rows: NewCatalogItem[] = allBrands.map((brand) => ({
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
  return { theme: brandsTheme, rows };
}

async function main() {
  const { theme, rows } = buildBrandsCatalog();
  console.log(`Seeding ${rows.length} brand catalog items...`);

  await db.insert(themesTable).values(theme).onConflictDoUpdate({ target: themesTable.id, set: theme });
  for (const placeholder of placeholderThemes) {
    await db.insert(themesTable).values(placeholder).onConflictDoNothing({ target: themesTable.id });
  }

  for (const row of rows) {
    await db
      .insert(catalogItemsTable)
      .values(row)
      .onConflictDoUpdate({ target: catalogItemsTable.id, set: { ...row, updatedAt: new Date() } });
  }

  console.log(`Done. ${rows.length} brand catalog items upserted.`);
  await pool.end();
}

// Only run main() when this file is executed directly (not when
// push-remote.ts imports buildBrandsCatalog for its own, DB-free flow).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
