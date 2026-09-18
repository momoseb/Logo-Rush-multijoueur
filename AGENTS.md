# AGENTS.md — Logo Rush

Guide for coding agents working in this repo. `replit.md` is Replit's own
agent-memory file (kept for the Replit Agent); this file is the fuller,
engineering-facing companion — read it first.

## What this is

A browser game (French UI) where players identify brand logos that
de-pixelate over time, solo or in real-time multiplayer rooms. pnpm
workspace, two runtime services (`artifacts/logo-rush` React frontend,
`artifacts/api-server` Express + Socket.IO backend), shared libs under
`lib/`. See `replit.md` for the stack/run-command summary.

## Running it locally (outside Replit)

Replit's own deployment router stitches the frontend (`/`) and API
(`/api`, `/socket.io`) onto one origin — see
`artifacts/*/.replit-artifact/artifact.toml` for the exact path→port
mapping. Outside Replit that router doesn't exist, so:

1. Postgres reachable via `DATABASE_URL`, then `pnpm --filter db run push`
   to sync the schema (there is no migrations folder — this project uses
   `drizzle-kit push`, not versioned migrations).
2. `DATABASE_URL=... PORT=5000 pnpm --filter @workspace/api-server run dev`
3. `artifacts/logo-rush/vite.config.ts` has a `server.proxy` for `/api`
   and `/socket.io` → `http://127.0.0.1:5000` (dev-server only, harmless
   in production builds) so `PORT=5173 BASE_PATH=/ VITE_BRANDFETCH_CLIENT_ID=... pnpm --filter @workspace/logo-rush run dev`
   works standalone without Replit's router.
4. `VITE_BRANDFETCH_CLIENT_ID` — a *public* client ID (safe to expose,
   Brandfetch's model), current value lives in `.replit`'s `[userenv.shared]`.

## Gotchas learned the hard way

- **`pnpm install` may report `ERR_PNPM_IGNORED_BUILDS` for `esbuild`** in
  sandboxes without a TTY (`pnpm approve-builds` needs interactive
  input). Workaround: `node node_modules/.pnpm/esbuild@<version>/node_modules/esbuild/install.js`
  once, then proceed — `esbuild` is already allow-listed in
  `pnpm-workspace.yaml`'s `onlyBuiltDependencies`, this is just a
  non-interactive-shell quirk. Don't "fix" it by editing
  `pnpm-workspace.yaml`; a plain `pnpm install` in that state can
  auto-append a spurious `allowBuilds:` stanza to it — revert that if
  you see it in your diff.
- **The socket returned by `lib/socket.ts#getSocket()` is a module-level
  singleton reused for the whole app lifetime** (room gameplay, home-page
  presence/live-stats, everything). Never call `socket.disconnect()` for
  a routine "leave this room" action — it tears down and reconnects the
  *entire* app's realtime connection. Use `socket.leave(roomCode)` /
  server-side room bookkeeping instead (see `game.ts`'s `leaveRoom`).
- **Player identity in multiplayer (`sessionId`) must be tab-scoped, not
  origin-scoped.** It's stored via zustand `persist` in `sessionStorage`
  (not `localStorage`) on purpose — two tabs of the same browser are the
  single most common way to playtest/host multiplayer locally, and the
  server matches players to sockets by `sessionId` (`game.ts`
  `room:join`). If it were shared across tabs, a second tab silently
  steals the first tab's player slot and the first tab's actions
  (`game:start`, guesses) become no-ops with zero client-side feedback.
  This was the root cause of a real "multiplayer doesn't work" bug —
  don't reintroduce it by moving session state back to `localStorage`.
- **DB schema drift between the Replit dev workspace and the deployed
  app is a real, silent failure mode.** `scripts/post-merge.sh` runs
  `pnpm --filter db push` on every merge *in the Replit dev workspace
  only* — the production build
  (`artifacts/api-server/.replit-artifact/artifact.toml`
  `[services.production.build]`) does **not** run any schema sync.
  `lib/db/src/index.ts` hard-throws if `DATABASE_URL` is unset, but a
  *stale* schema (e.g. a table the code expects that was never pushed to
  the prod DB) fails silently per-request instead: the route throws, the
  frontend's `useGetSoloLeaderboard`/etc. hooks don't check `isError`
  everywhere, and a broken leaderboard looks identical to an empty one.
  If a "data disappeared" bug is reported in production, check schema
  drift first. See tracked issue for wiring an automatic schema sync
  into the production build step.
- **This sandboxed environment's outbound TLS proxy breaks
  `cdn.brandfetch.io` requests** (`net::ERR_CERT_AUTHORITY_INVALID`),
  which makes every `PixelatedLogo` show "Image indisponible" here. Not
  a real app bug — verified by launching Chromium with
  `--ignore-certificate-errors` / `ignoreHTTPSErrors: true`, after which
  real logo images load and reveal normally. Don't chase "every logo is
  missing" as a regression without first checking this.
- **Testing multiplayer with Playwright**: two `browser.newContext()`
  calls give each "player" fully isolated storage, like two different
  devices/browsers — use that to simulate two real, independent players.
  Two *pages in the same context* (`context.newPage()` twice) simulate
  two tabs of the same browser: they share `localStorage`/cookies but
  each gets its own `sessionStorage` — this is exactly the
  "same-browser-two-tabs" scenario the sessionId gotcha above guards
  against, so use this setup specifically to regression-test it.

## Architecture notes

- Multiplayer game state and scoring are authoritative server-side only
  (`artifacts/api-server/src/game.ts`); round answers are never sent to
  clients until the round ends. Solo-mode scores are **not**
  server-verified — the client computes and submits its own score,
  capped server-side only by a sanity ceiling (`score ≤ roundCount *
  1000`). See open issues about hardening this.
- `lib/api-spec/openapi.yaml` is the source of truth for the REST API;
  `lib/api-zod` (Zod schemas) and `lib/api-client-react` (React Query
  hooks) are generated from it via
  `pnpm --filter @workspace/api-spec run codegen`. Edit the YAML, then
  regenerate — don't hand-edit `generated/` files. Zod/hook export names
  for request/response bodies are derived from the operation name (e.g.
  `reportLogo` → `ReportLogoBody`/`ReportLogoResponse`), not from the
  `$ref` component schema name — check the generated `api.ts` for the
  real export name rather than guessing from the OpenAPI schema name.
- Real-time protocol (Socket.IO events) is not part of the OpenAPI spec
  and has no generated types; client and server event shapes in
  `room.tsx` / `game.ts` are kept in sync by hand. Watch for drift here.
- `artifacts/logo-rush/src/pages/logo-audit.tsx` (`/logo-audit`) is an
  internal, unauthenticated QA tool for eyeballing which of the ~380
  catalog logos actually render via Brandfetch. The player-facing
  "Signaler ce logo" button (`components/report-logo-button.tsx`,
  `POST /api/game/logo-reports`, `logo_reports` table) is a different,
  complementary mechanism: it lets real players flag a logo as
  unrecognizable/wrong *during play*, persisted server-side. Nothing
  currently reads the `logo_reports` table back out — there's no
  admin view yet; querying it directly is the current workflow for
  triaging which catalog entries to fix or drop.

## Known open issues

Tracked as GitHub issues (filed after the audit that produced this
file) rather than duplicated here in detail — search issues for the
current list. Headline items at time of writing:

1. Production deploys never re-sync the DB schema (see gotcha above) —
   highest-impact, most likely to silently break a feature again.
2. Reconnecting mid-round (e.g. a page refresh) leaves a multiplayer
   client stuck on the "waiting for host" screen — the server never
   replays a `round:start` to a socket that (re)joins mid-game.
3. `PixelatedLogo` reloads the image from the network on every
   `progress` tick (~10/s) with no cleanup of in-flight loads.
4. No rate limiting or server-side proof-of-play anywhere (solo score
   submission, guesses, room creation, logo reports).
5. No automated tests and no CI workflow in this repo.

## User preferences

_Populate as you build — explicit user instructions worth remembering
across sessions._

## Pointers

- `replit.md` — Replit-specific run commands and product summary.
- `.agents/memory/` — prior agent session notes (Brandfetch API usage,
  etc.).
