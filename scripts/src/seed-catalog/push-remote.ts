// Populates a deployed environment's catalog over the admin HTTP API
// instead of a direct DB connection. This is the supported path when the
// machine running the seed can't reach Postgres directly — e.g. a
// sandboxed session whose network policy only allows outbound HTTPS (no
// raw-TCP databases), or before paying for Render's Shell add-on. It
// reuses the exact same fetch/filter/transform logic as the DB-writing
// seed scripts (buildBrandsCatalog, buildFootballClubsCatalog, etc.) —
// only the last step (how the rows get persisted) differs.
//
// Run with API_BASE_URL and ADMIN_TOKEN set, plus whichever third-party
// key the requested theme(s) need:
//   API_BASE_URL=https://logo-rush-api.onrender.com/api ADMIN_TOKEN=... \
//     FOOTBALL_DATA_API_KEY=... pnpm --filter @workspace/scripts run seed-push-remote -- --theme football-clubs
// Omit --theme (or pass --theme all) to push every theme whose required
// key is set. DATABASE_URL is NOT required for this script itself — see
// the placeholder note in main() below for why one still gets set.
import type { NewCatalogItem, NewTheme } from "@workspace/db";

type ThemeJob = {
  id: string;
  requiredEnvVar?: string;
  build: () => Promise<{ theme: NewTheme; rows: NewCatalogItem[] }>;
};

async function postJson(url: string, token: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`POST ${url} -> HTTP ${response.status}: ${text}`);
  }
  return response.json();
}

async function pushTheme(apiBase: string, token: string, job: ThemeJob) {
  console.log(`[push-remote] ${job.id}: fetching + transforming...`);
  const { theme, rows } = await job.build();
  console.log(`[push-remote] ${job.id}: ${rows.length} items built, pushing theme + items to ${apiBase}...`);

  await postJson(`${apiBase}/admin/themes`, token, theme);

  // Bulk endpoint caps at 2000 items per call — every theme here is well
  // under that, so a single call is enough.
  const result = (await postJson(`${apiBase}/admin/catalog/bulk`, token, rows)) as { count: number };
  console.log(`[push-remote] ${job.id}: done, ${result.count} items upserted via admin API.`);
}

async function main() {
  const apiBase = process.env.API_BASE_URL;
  const token = process.env.ADMIN_TOKEN;
  if (!apiBase || !token) {
    console.error("API_BASE_URL and ADMIN_TOKEN must both be set (e.g. API_BASE_URL=https://logo-rush-api.onrender.com/api).");
    process.exitCode = 1;
    return;
  }

  // @workspace/db (imported transitively by the seed-*.ts modules below, for
  // their table/type definitions) throws at import time if DATABASE_URL is
  // unset. It only constructs a pg.Pool though, which doesn't actually
  // connect until a query runs — and this script never issues one (it only
  // calls each module's pure buildXxxCatalog(), never db/pool). A
  // placeholder is enough to satisfy that check without a real database, so
  // this script keeps working in an environment that only has HTTPS egress.
  process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";

  const [{ buildBrandsCatalog }, { buildFootballClubsCatalog }, { buildMoviesCatalog }, { buildVideoGamesCatalog }] = await Promise.all([
    import("./seed-brands"),
    import("./seed-football-clubs"),
    import("./seed-movies"),
    import("./seed-video-games"),
  ]);

  const jobs: ThemeJob[] = [
    { id: "brands", build: async () => buildBrandsCatalog() },
    {
      id: "football-clubs",
      requiredEnvVar: "FOOTBALL_DATA_API_KEY",
      build: async () => buildFootballClubsCatalog(process.env.FOOTBALL_DATA_API_KEY!),
    },
    { id: "movies", requiredEnvVar: "TMDB_API_KEY", build: async () => buildMoviesCatalog(process.env.TMDB_API_KEY!) },
    {
      id: "video-games",
      requiredEnvVar: "RAWG_API_KEY",
      build: async () => buildVideoGamesCatalog(process.env.RAWG_API_KEY!),
    },
  ];

  const themeArgIndex = process.argv.indexOf("--theme");
  const requestedTheme = themeArgIndex >= 0 ? process.argv[themeArgIndex + 1] : "all";

  const selected = jobs.filter((job) => requestedTheme === "all" || job.id === requestedTheme);
  if (selected.length === 0) {
    console.error(`No matching theme for --theme ${requestedTheme}. Valid ids: ${jobs.map((job) => job.id).join(", ")}, or "all".`);
    process.exitCode = 1;
    return;
  }

  for (const job of selected) {
    if (job.requiredEnvVar && !process.env[job.requiredEnvVar]) {
      console.warn(`[push-remote] ${job.id}: skipping, ${job.requiredEnvVar} is not set.`);
      continue;
    }
    await pushTheme(apiBase.replace(/\/$/, ""), token, job);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
