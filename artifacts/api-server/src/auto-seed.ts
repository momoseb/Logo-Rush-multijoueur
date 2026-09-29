import { count, eq } from "drizzle-orm";
import { db, catalogItemsTable, themesTable } from "@workspace/db";
import { buildSeriesCatalog, SERIES_THEME_ID } from "@workspace/db/catalog-sources";
import { refreshCatalog } from "./game";
import { logger } from "./lib/logger";

// Fills the "series" theme by itself, at startup, when TMDB_API_KEY is set
// on the server and the theme has no items yet — so enabling it only takes
// adding that env var on Render (which redeploys), no seed script, no
// ADMIN_TOKEN and no direct DB access (see the AGENTS.md sandbox gotcha).
// Runs in the background: the server starts serving the existing themes
// right away and the new one appears once refreshCatalog() has run.
//
// Only ever seeds an *empty* theme — never overwrites or refreshes an
// existing catalog on restart. Re-running a full resync stays the job of
// seed-series.ts / push-remote.ts.
export async function autoSeedCatalog() {
  const apiKey = process.env["TMDB_API_KEY"];
  if (!apiKey) return;

  const [existing] = await db.select({ value: count() }).from(catalogItemsTable).where(eq(catalogItemsTable.themeId, SERIES_THEME_ID));
  if ((existing?.value ?? 0) > 0) return;

  logger.info("Series theme is empty and TMDB_API_KEY is set: seeding it from TMDB");
  const { theme, rows } = await buildSeriesCatalog(apiKey);
  if (rows.length === 0) {
    logger.warn("TMDB returned no series, theme left empty");
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(themesTable)
      .values({ ...theme, enabled: true })
      .onConflictDoUpdate({ target: themesTable.id, set: { ...theme, enabled: true } });
    await tx.delete(catalogItemsTable).where(eq(catalogItemsTable.themeId, SERIES_THEME_ID));
    await tx.insert(catalogItemsTable).values(rows);
  });
  await refreshCatalog();
  logger.info({ count: rows.length }, "Series theme seeded from TMDB");
}
