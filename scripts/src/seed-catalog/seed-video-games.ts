// Populates the "video-games" theme from RAWG (free tier explicitly allows
// commercial use up to 20,000 requests/month — chosen over IGDB, whose free
// tier is non-commercial only, see the multi-theme plan).
//
// Run with DATABASE_URL and RAWG_API_KEY set:
//   RAWG_API_KEY=... pnpm --filter @workspace/scripts run seed-video-games
import { eq } from "drizzle-orm";
import { db, pool, themesTable, catalogItemsTable, makeCatalogItemId, type NewTheme, type NewCatalogItem } from "@workspace/db";

const THEME_ID = "video-games";
const theme: NewTheme = { id: THEME_ID, nameFr: "Jeux vidéo", nameEn: "Video games", imageProvider: "rawg", aspectW: 3, aspectH: 4, enabled: true, sortOrder: 3 };
const API_BASE = "https://api.rawg.io/api/games";
const PAGE_SIZE = 40;
// "-added" (most added to players' libraries) is a much better proxy for
// "recognizable by a casual player" than "-rating", which surfaces small
// highly-rated indie titles most people have never seen.
const PAGES = 5;
// RAWG has no explicit "AAA" flag, so two queries approximate "recent
// and/or AAA", merged and deduped by id:
//  - "recent": released in the last RECENT_YEARS years.
//  - "AAA-caliber": high Metacritic score, any era — a large-budget,
//    widely-marketed game overwhelmingly clears this bar for its
//    well-known titles. Not a real AAA filter (RAWG doesn't expose
//    publisher budget/tier), just a reasonable, documented proxy.
const RECENT_YEARS = 5;
const recentSince = `${new Date().getFullYear() - RECENT_YEARS}-01-01`;
const today = new Date().toISOString().slice(0, 10);
const QUERY_SETS = [
  { label: "recent", extraParams: `dates=${recentSince},${today}` },
  { label: "AAA-caliber", extraParams: `metacritic=75,100` },
];

type RawgGame = {
  id: number;
  name: string;
  background_image?: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(apiKey: string, extraParams: string, page: number): Promise<RawgGame[]> {
  const url = `${API_BASE}?key=${encodeURIComponent(apiKey)}&ordering=-added&page_size=${PAGE_SIZE}&page=${page}&${extraParams}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`[seed-video-games] page ${page} (${extraParams}): HTTP ${response.status}, skipping.`);
    return [];
  }
  const data = (await response.json()) as { results?: RawgGame[] };
  return data.results ?? [];
}

// Pure fetch/transform, no DB access — reused by main() below (writes
// straight to the DB) and by push-remote.ts (writes via the admin HTTP API
// when direct DB access isn't available, e.g. from a sandboxed session).
export async function buildVideoGamesCatalog(apiKey: string): Promise<{ theme: NewTheme; rows: NewCatalogItem[] }> {
  const gamesById = new Map<number, RawgGame>();
  for (const { label, extraParams } of QUERY_SETS) {
    for (let page = 1; page <= PAGES; page += 1) {
      const games = await fetchPage(apiKey, extraParams, page);
      for (const game of games) if (game.background_image) gamesById.set(game.id, game);
      console.log(`[seed-video-games] ${label} page ${page}: ${games.length} games (running total ${gamesById.size} unique)`);
      await sleep(300);
    }
  }

  const rows: NewCatalogItem[] = [...gamesById.values()].map((game) => ({
    id: makeCatalogItemId(THEME_ID, String(game.id)),
    themeId: THEME_ID,
    answerFr: game.name,
    answerEn: game.name,
    aliasesFr: [],
    aliasesEn: [],
    difficulty: "medium",
    category: null,
    imageRef: game.background_image!,
    active: true,
  }));

  return { theme, rows };
}

async function main() {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    console.error(
      "RAWG_API_KEY is not set. Create a free account and API key at https://rawg.io/apidocs " +
        "(see the multi-theme plan for the full step-by-step) then re-run with RAWG_API_KEY=... set.",
    );
    process.exitCode = 1;
    return;
  }

  const { rows } = await buildVideoGamesCatalog(apiKey);

  // Full resync rather than a plain upsert — see seed-movies.ts for why.
  // Safe because this theme's content is 100% RAWG-sourced.
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

  console.log(`Done. ${rows.length} video games upserted. Theme enabled: ${rows.length > 0}.`);
  await pool.end();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
