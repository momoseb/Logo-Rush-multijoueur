// Populates the "series" theme (TV show posters) from TMDB. The fetch/filter
// logic lives in @workspace/db/catalog-sources (shared with the api-server's
// startup auto-seed); this script only writes the result to the DB.
//
// Run with DATABASE_URL and TMDB_API_KEY set:
//   TMDB_API_KEY=... pnpm --filter @workspace/scripts run seed-series
// or, without direct DB access, via push-remote.ts (--theme series).
import { eq } from "drizzle-orm";
import { db, pool, themesTable, catalogItemsTable } from "@workspace/db";
import { buildSeriesCatalog, SERIES_THEME_ID as THEME_ID } from "@workspace/db/catalog-sources";

export { buildSeriesCatalog };

async function main() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error(
      "TMDB_API_KEY is not set. Create a free account and API key at https://www.themoviedb.org/settings/api " +
        "(see the multi-theme plan for the full step-by-step) then re-run with TMDB_API_KEY=... set.",
    );
    process.exitCode = 1;
    return;
  }

  const { theme, rows } = await buildSeriesCatalog(apiKey);

  // Full resync rather than a plain upsert — see seed-movies.ts for why.
  // Safe because this theme's content is 100% TMDB-sourced.
  await db.delete(catalogItemsTable).where(eq(catalogItemsTable.themeId, THEME_ID));
  for (const row of rows) {
    await db
      .insert(catalogItemsTable)
      .values(row)
      .onConflictDoUpdate({ target: catalogItemsTable.id, set: { ...row, updatedAt: new Date() } });
  }

  if (rows.length > 0) {
    await db
      .insert(themesTable)
      .values({ ...theme, enabled: true })
      .onConflictDoUpdate({ target: themesTable.id, set: { ...theme, enabled: true } });
  }

  console.log(`Done. ${rows.length} series upserted. Theme enabled: ${rows.length > 0}.`);
  await pool.end();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
