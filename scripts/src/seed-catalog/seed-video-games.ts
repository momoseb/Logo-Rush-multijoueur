// Populates the "video-games" theme from RAWG (free tier explicitly allows
// commercial use up to 20,000 requests/month — chosen over IGDB, whose free
// tier is non-commercial only, see the multi-theme plan).
//
// Run with DATABASE_URL and RAWG_API_KEY set:
//   RAWG_API_KEY=... pnpm --filter @workspace/scripts run seed-video-games
import { db, pool, themesTable, catalogItemsTable, makeCatalogItemId } from "@workspace/db";

const THEME_ID = "video-games";
const theme = { id: THEME_ID, nameFr: "Jeux vidéo", nameEn: "Video games", imageProvider: "rawg", aspectW: 3, aspectH: 4, sortOrder: 3 };
const API_BASE = "https://api.rawg.io/api/games";
const PAGE_SIZE = 40;
// "-added" (most added to players' libraries) is a much better proxy for
// "recognizable by a casual player" than "-rating", which surfaces small
// highly-rated indie titles most people have never seen.
const PAGES = 5;

type RawgGame = {
  id: number;
  name: string;
  background_image?: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(apiKey: string, page: number): Promise<RawgGame[]> {
  const url = `${API_BASE}?key=${encodeURIComponent(apiKey)}&ordering=-added&page_size=${PAGE_SIZE}&page=${page}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`[seed-video-games] page ${page}: HTTP ${response.status}, skipping.`);
    return [];
  }
  const data = (await response.json()) as { results?: RawgGame[] };
  return data.results ?? [];
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

  const rows: (typeof catalogItemsTable.$inferInsert)[] = [];
  for (let page = 1; page <= PAGES; page += 1) {
    const games = await fetchPage(apiKey, page);
    for (const game of games) {
      if (!game.background_image) continue;
      rows.push({
        id: makeCatalogItemId(THEME_ID, String(game.id)),
        themeId: THEME_ID,
        answerFr: game.name,
        answerEn: game.name,
        aliasesFr: [],
        aliasesEn: [],
        difficulty: "medium",
        category: null,
        imageRef: game.background_image,
        active: true,
      });
    }
    console.log(`[seed-video-games] page ${page}: ${games.length} games (running total ${rows.length})`);
    await sleep(300);
  }

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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
