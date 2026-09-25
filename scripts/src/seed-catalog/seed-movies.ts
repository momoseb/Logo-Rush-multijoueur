// Populates the "movies" theme from TMDB (free for non-commercial use, or
// an ad-supported site that credits TMDB per their own FAQ — see the
// multi-theme plan). Requires a TMDB "API Read Access Token" (the long
// Bearer token from https://www.themoviedb.org/settings/api, not the short
// v3 "API Key").
//
// Run with DATABASE_URL and TMDB_API_KEY set:
//   TMDB_API_KEY=... pnpm --filter @workspace/scripts run seed-movies
import { eq } from "drizzle-orm";
import { db, pool, themesTable, catalogItemsTable, makeCatalogItemId } from "@workspace/db";

const THEME_ID = "movies";
const theme = { id: THEME_ID, nameFr: "Affiches de films", nameEn: "Movie posters", imageProvider: "tmdb", aspectW: 2, aspectH: 3, sortOrder: 2 };
const API_BASE = "https://api.themoviedb.org/3";
const POSTER_SIZE = "w500";
// Popular, well-known films are far easier to guess from a poster than
// obscure ones — pulling several pages of "popularity.desc" gives a good
// mix while staying recognizable.
const PAGES = 5;
// Keep the catalog to films a player could plausibly recognize today —
// computed from the current date at run time, never a hardcoded year.
const MAX_AGE_YEARS = 50;
const minReleaseDate = `${new Date().getFullYear() - MAX_AGE_YEARS}-01-01`;
// TMDB's "popularity" score also picks up small/regional films having a
// short-lived trending moment (new local theatrical releases, etc). A
// minimum vote count is a much better proxy for "a player has plausibly
// heard of this" — big, well-known films accumulate thousands of votes;
// obscure ones rarely clear a few hundred.
const MIN_VOTE_COUNT = 1000;

type TmdbMovie = {
  id: number;
  title: string;
  original_title?: string;
  poster_path?: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchDiscoverPage(apiKey: string, language: string, page: number): Promise<TmdbMovie[]> {
  const url = `${API_BASE}/discover/movie?language=${language}&sort_by=popularity.desc&page=${page}&include_adult=false&primary_release_date.gte=${minReleaseDate}&vote_count.gte=${MIN_VOTE_COUNT}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" } });
  if (!response.ok) {
    console.warn(`[seed-movies] ${language} page ${page}: HTTP ${response.status}, skipping.`);
    return [];
  }
  const data = (await response.json()) as { results?: TmdbMovie[] };
  return data.results ?? [];
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

  const rows: (typeof catalogItemsTable.$inferInsert)[] = [];
  for (let page = 1; page <= PAGES; page += 1) {
    const [frResults, enResults] = await Promise.all([
      fetchDiscoverPage(apiKey, "fr-FR", page),
      fetchDiscoverPage(apiKey, "en-US", page),
    ]);
    const enById = new Map(enResults.map((movie) => [movie.id, movie]));

    for (const frMovie of frResults) {
      if (!frMovie.poster_path) continue;
      const enMovie = enById.get(frMovie.id);
      const answerFr = frMovie.title;
      const answerEn = enMovie?.title || frMovie.title;
      const aliasesFr = frMovie.original_title && frMovie.original_title !== answerFr ? [frMovie.original_title] : [];
      const aliasesEn = enMovie?.original_title && enMovie.original_title !== answerEn ? [enMovie.original_title] : [];
      rows.push({
        id: makeCatalogItemId(THEME_ID, String(frMovie.id)),
        themeId: THEME_ID,
        answerFr,
        answerEn,
        aliasesFr,
        aliasesEn,
        difficulty: "medium",
        category: null,
        imageRef: `https://image.tmdb.org/t/p/${POSTER_SIZE}${frMovie.poster_path}`,
        active: true,
      });
    }
    console.log(`[seed-movies] page ${page}: ${frResults.length} movies (running total ${rows.length})`);
    await sleep(250);
  }

  // Full resync rather than a plain upsert: without this, re-running the
  // script after tightening a filter (as happened with MIN_VOTE_COUNT)
  // would leave previously-imported, now-excluded movies stranded in the
  // catalog forever. Safe because this theme's content is 100%
  // TMDB-sourced — nothing else writes to it.
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

  console.log(`Done. ${rows.length} movies upserted. Theme enabled: ${rows.length > 0}.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
