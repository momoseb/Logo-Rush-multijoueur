// Populates the "series" theme (TV show posters) from TMDB — same API, same
// key and same attribution as seed-movies.ts, just the /discover/tv
// endpoint (whose results use `name`/`original_name` instead of
// `title`/`original_title`, and `first_air_date` instead of
// `primary_release_date`).
//
// Run with DATABASE_URL and TMDB_API_KEY set:
//   TMDB_API_KEY=... pnpm --filter @workspace/scripts run seed-series
// or, without direct DB access, via push-remote.ts (--theme series).
import { eq } from "drizzle-orm";
import { db, pool, themesTable, catalogItemsTable, makeCatalogItemId, type NewTheme, type NewCatalogItem } from "@workspace/db";

const THEME_ID = "series";
const theme: NewTheme = { id: THEME_ID, nameFr: "Séries", nameEn: "TV series", imageProvider: "tmdb", aspectW: 2, aspectH: 3, enabled: true, sortOrder: 4 };
const API_BASE = "https://api.themoviedb.org/3";
const POSTER_SIZE = "w500";
// 20 results/page, so 15 pages ~= 300 shows. The vote-count floor does most
// of the "recognizable" filtering (see seed-movies.ts); it's lower than for
// movies because TV shows accumulate far fewer TMDB votes than films of
// comparable fame.
const PAGES = 15;
const MAX_AGE_YEARS = 40;
const minFirstAirDate = `${new Date().getFullYear() - MAX_AGE_YEARS}-01-01`;
const MIN_VOTE_COUNT = 500;
// TMDB's /discover/tv popularity ranking is dominated by daily soaps, talk
// shows, news and reality TV, whose posters are mostly a logo or a host's
// face — not guessable. Scripted genres only.
const EXCLUDED_GENRE_IDS = [
  10763, // News
  10764, // Reality
  10766, // Soap
  10767, // Talk
];

type TmdbShow = {
  id: number;
  name: string;
  original_name?: string;
  poster_path?: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchDiscoverPage(apiKey: string, language: string, page: number): Promise<TmdbShow[]> {
  const url = `${API_BASE}/discover/tv?language=${language}&sort_by=popularity.desc&page=${page}&include_adult=false&first_air_date.gte=${minFirstAirDate}&vote_count.gte=${MIN_VOTE_COUNT}&without_genres=${EXCLUDED_GENRE_IDS.join(",")}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" } });
  if (!response.ok) {
    console.warn(`[seed-series] ${language} page ${page}: HTTP ${response.status}, skipping.`);
    return [];
  }
  const data = (await response.json()) as { results?: TmdbShow[] };
  return data.results ?? [];
}

// Pure fetch/transform, no DB access — reused by main() below (writes
// straight to the DB) and by push-remote.ts (writes via the admin HTTP API
// when direct DB access isn't available, e.g. from a sandboxed session).
export async function buildSeriesCatalog(apiKey: string): Promise<{ theme: NewTheme; rows: NewCatalogItem[] }> {
  const rows: NewCatalogItem[] = [];
  // Popularity can shift between two page requests, so the same show can
  // occasionally appear on two pages — dedupe by TMDB id.
  const seen = new Set<number>();
  for (let page = 1; page <= PAGES; page += 1) {
    const [frResults, enResults] = await Promise.all([
      fetchDiscoverPage(apiKey, "fr-FR", page),
      fetchDiscoverPage(apiKey, "en-US", page),
    ]);
    const enById = new Map(enResults.map((show) => [show.id, show]));

    for (const frShow of frResults) {
      if (!frShow.poster_path || seen.has(frShow.id)) continue;
      seen.add(frShow.id);
      const enShow = enById.get(frShow.id);
      const answerFr = frShow.name;
      const answerEn = enShow?.name || frShow.name;
      const aliasesFr = frShow.original_name && frShow.original_name !== answerFr ? [frShow.original_name] : [];
      const aliasesEn = enShow?.original_name && enShow.original_name !== answerEn ? [enShow.original_name] : [];
      rows.push({
        id: makeCatalogItemId(THEME_ID, String(frShow.id)),
        themeId: THEME_ID,
        answerFr,
        answerEn,
        aliasesFr,
        aliasesEn,
        difficulty: "medium",
        category: null,
        imageRef: `https://image.tmdb.org/t/p/${POSTER_SIZE}${frShow.poster_path}`,
        active: true,
      });
    }
    console.log(`[seed-series] page ${page}: ${frResults.length} shows (running total ${rows.length})`);
    await sleep(250);
  }

  return { theme, rows };
}

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

  const { rows } = await buildSeriesCatalog(apiKey);

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
