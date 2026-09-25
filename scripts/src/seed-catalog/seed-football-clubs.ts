// Populates the "football-clubs" theme from football-data.org (free tier:
// https://www.football-data.org/client/register, no payment ever required
// for this usage — see the multi-theme plan for why this was chosen over
// TheSportsDB, whose free key is documented as personal/hobby-only).
//
// Run with DATABASE_URL and FOOTBALL_DATA_API_KEY set:
//   FOOTBALL_DATA_API_KEY=... pnpm --filter @workspace/scripts run seed-football-clubs
import { eq } from "drizzle-orm";
import { db, pool, themesTable, catalogItemsTable, makeCatalogItemId, type NewTheme, type NewCatalogItem } from "@workspace/db";

const THEME_ID = "football-clubs";
const theme: NewTheme = { id: THEME_ID, nameFr: "Clubs de foot", nameEn: "Football clubs", imageProvider: "football-data", aspectW: 1, aspectH: 1, enabled: true, sortOrder: 1 };
const API_BASE = "https://api.football-data.org/v4";

// Top European competitions, including Ligue 1 for the game's French
// audience. football-data.org's free tier covers exactly these "top 12"
// competitions — see the multi-theme plan. All 6 are top-flight domestic
// leagues (PL/FL1/PD/SA/BL1) or a cup that only top-flight clubs qualify
// for (CL) — this already satisfies "first-division clubs only" without
// any extra filtering.
const COMPETITION_CODES = ["PL", "FL1", "PD", "SA", "BL1", "CL"];

type FootballDataTeam = {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCompetitionTeams(apiKey: string, code: string): Promise<FootballDataTeam[]> {
  const response = await fetch(`${API_BASE}/competitions/${code}/teams`, {
    headers: { "X-Auth-Token": apiKey },
  });
  if (!response.ok) {
    console.warn(`[seed-football-clubs] ${code}: HTTP ${response.status}, skipping this competition.`);
    return [];
  }
  const data = (await response.json()) as { teams?: FootballDataTeam[] };
  return data.teams ?? [];
}

// Pure fetch/transform, no DB access — reused by main() below (writes
// straight to the DB) and by push-remote.ts (writes via the admin HTTP API
// when direct DB access isn't available, e.g. from a sandboxed session).
export async function buildFootballClubsCatalog(apiKey: string): Promise<{ theme: NewTheme; rows: NewCatalogItem[] }> {
  const teamsById = new Map<number, FootballDataTeam>();
  for (const code of COMPETITION_CODES) {
    const teams = await fetchCompetitionTeams(apiKey, code);
    for (const team of teams) teamsById.set(team.id, team);
    console.log(`[seed-football-clubs] ${code}: ${teams.length} teams (running total ${teamsById.size} unique)`);
    // Free tier is rate-limited to 10 requests/minute — stay comfortably
    // under that between competitions.
    await sleep(6500);
  }

  const rows: NewCatalogItem[] = [...teamsById.values()]
    .filter((team) => team.crest)
    .map((team) => {
      const aliases = [team.shortName, team.tla].filter((value): value is string => Boolean(value) && value !== team.name);
      return {
        id: makeCatalogItemId(THEME_ID, String(team.id)),
        themeId: THEME_ID,
        answerFr: team.name,
        answerEn: team.name,
        aliasesFr: aliases,
        aliasesEn: aliases,
        difficulty: "medium",
        category: null,
        imageRef: team.crest!,
        active: true,
      };
    });

  return { theme, rows };
}

async function main() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.error(
      "FOOTBALL_DATA_API_KEY is not set. Get a free key at https://www.football-data.org/client/register " +
        "(see the multi-theme plan for the full step-by-step) then re-run with FOOTBALL_DATA_API_KEY=... set.",
    );
    process.exitCode = 1;
    return;
  }

  const { rows } = await buildFootballClubsCatalog(apiKey);

  // Full resync rather than a plain upsert: a club relegated out of the
  // tracked competitions (or a filter tightened later, as happened with
  // movies) would otherwise stay stranded in the catalog forever. Safe
  // because this theme's content is 100% football-data.org-sourced.
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

  console.log(`Done. ${rows.length} football clubs upserted. Theme enabled: ${rows.length > 0}.`);
  await pool.end();
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
