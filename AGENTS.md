# AGENTS.md — Logo Rush

Guide for coding agents working in this repo. `replit.md` is Replit's own
agent-memory file (kept for the Replit Agent); this file is the fuller,
engineering-facing companion — read it first. See `DEPLOY.md` for the
production topology (Vercel frontend + Render backend).

## What this is

A browser game (French UI) where players identify brand logos that
de-pixelate over time, solo or in real-time multiplayer rooms. pnpm
workspace, two runtime services (`artifacts/logo-rush` React frontend,
`artifacts/api-server` Express + Socket.IO backend), shared libs under
`lib/`. See `replit.md` for the stack/run-command summary.

Production deploys the frontend and backend as two **separate origins**
(Vercel + Render) — not something Replit's router stitches together
anymore. `VITE_API_BASE_URL` (frontend) is what makes this work: unset,
everything assumes same-origin (still true for local dev via the vite
proxy, or if you ever put a router back in front of both); set, every
`/api` call and the Socket.IO connection target that URL explicitly. See
`artifacts/logo-rush/src/main.tsx` and `src/lib/socket.ts`.

## Running it locally / deploying

See `DEPLOY.md` — it covers local dev (Postgres + api-server + vite dev
server, no Replit router needed) and the Vercel (frontend) + Render
(backend) production topology, including which env vars each side needs
(`VITE_API_BASE_URL`, `VITE_BRANDFETCH_CLIENT_ID`, `DATABASE_URL`).

There is no migrations folder — this project uses `drizzle-kit push`
(`pnpm --filter db run push`), not versioned migrations. Render's build
command runs this on every deploy for exactly that reason (see next
gotcha).

## Gotchas learned the hard way

- **On pnpm 12.x, `onlyBuiltDependencies` in `pnpm-workspace.yaml` is
  *not* enough on its own to let `pnpm install` run a dependency's build
  script non-interactively** (contrary to older pnpm docs/expectations).
  Without an explicit approval, `pnpm install` — including
  `--frozen-lockfile`, e.g. on a fresh Render/CI checkout — fails hard
  with `ERR_PNPM_IGNORED_BUILDS` for `esbuild`, even though `esbuild` is
  listed in `onlyBuiltDependencies`. The actual fix (already applied,
  see the `allowBuilds:` block right under `onlyBuiltDependencies` in
  `pnpm-workspace.yaml`) is a *second*, separate approval ledger that
  `pnpm approve-builds --all -y` writes automatically; it can also be
  hand-written the same way. If a future dependency change reintroduces
  this error for some other package, don't work around it with a manual
  `node .../install.js` one-off (doesn't help CI) or `--ignore-scripts`
  (skips the package's real setup) — run `pnpm approve-builds --all -y`
  in a normal terminal and commit the `allowBuilds:` entry it adds.
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
- **DB schema drift is a real, silent failure mode — this is what
  likely broke the leaderboard once already.** `lib/db/src/index.ts`
  hard-throws if `DATABASE_URL` is unset, but a merely *stale* schema
  (a table the code expects that was never pushed to that environment's
  DB) fails silently per-request instead: the route throws, the
  frontend's `useGetSoloLeaderboard`/etc. hooks didn't originally check
  `isError` everywhere (now fixed for `SoloLeaderboard`, but audit the
  rest if you touch them), and a broken leaderboard looked identical to
  an empty one. The Render build command (`render.yaml`,
  `DEPLOY.md`) now runs `pnpm --filter db run push` on every deploy for
  exactly this reason — don't remove that step. If still developing via
  the Replit workspace, note that `scripts/post-merge.sh` only syncs
  schema *there*, on merge; it has no bearing on Render.
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
- **Guesses are validated server-side in both modes, and the catalog
  answer/id are never shipped to a playing client before a round ends**
  (`artifacts/api-server/src/logo-token.ts` +
  `routes/game.ts#/game/solo/*`, `/game/logo-image/:token`). Catalog ids
  are literal answer slugs (e.g. `"louisvuitton"` for "Louis Vuitton") and
  `Logo.imageUrl` (`brandfetch://<domain>`) is just as readable, so
  neither ever reaches a client directly during play — only an opaque,
  AES-256-GCM-encrypted per-round token does (signed+encrypted, not just
  base64: base64 alone is trivially reversible in the browser console and
  would leak the id right back). The token decrypts server-side to
  resolve a guess (`POST /game/solo/guess`), reveal the answer once a
  round is over (`POST /game/solo/reveal`, or the multiplayer `round:end`
  socket event), fetch the actual logo image without exposing its domain
  (`GET /game/logo-image/:token`, which proxies the Brandfetch CDN
  request from the server instead of the browser), or resolve a "Signaler
  ce logo" report (`POST /game/logo-reports` — despite the field still
  being named `logoId` for schema-compat, it's a token now, not a raw
  id). `GET /game/logos` (full catalog incl. `answer`/`domain`) still
  exists and is intentionally unchanged — it's what the unauthenticated
  `/logo-audit` QA tool reads, a different, deliberately-unauthenticated
  consumer (see below); it is simply no longer used by actual gameplay.
  This closes the "open DevTools → Network tab → read the answer in
  plaintext" cheat that both modes had before (solo shipped the *entire*
  answer key up front via `/game/logos`; multiplayer's `round:start`
  socket frame carried the raw id/domain). What's still true, on
  purpose: solo *scores* remain client-computed (only guess-correctness
  moved server-side), and a determined player who scripts direct API
  calls (rather than reading passively) can still call `/reveal`
  immediately — see the "no rate limiting / proof-of-play" open issue
  below, which this doesn't attempt to fix.
- `game.ts`'s `roomView()` strips both `socketId` and `sessionId` from
  the player list before broadcasting it to a room. Don't add `sessionId`
  back there: `room:join` reconnects a socket to its player slot purely
  by matching `sessionId` (see the sessionId gotcha above), so leaking
  every player's `sessionId` to the rest of the room would let anyone
  reconnect *as* another player (steal host status, submit guesses in
  their name) — the frontend never reads another player's `sessionId`,
  only its own from the store, so stripping it has no functional cost.
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

1. ~~Production deploys never re-sync the DB schema~~ — fixed for the
   Render deploy path (build command runs `pnpm --filter db run push`,
   see `DEPLOY.md`). Still relevant if a deployment target is added that
   doesn't run that step.
2. Reconnecting mid-round (e.g. a page refresh) leaves a multiplayer
   client stuck on the "waiting for host" screen — the server never
   replays a `round:start` to a socket that (re)joins mid-game.
3. `PixelatedLogo` reloads the image from the network on every
   `progress` tick (~10/s) with no cleanup of in-flight loads.
4. No rate limiting or server-side proof-of-play anywhere (solo score
   submission, guesses, room creation, logo reports). Note this is
   distinct from the "answer visible in the Network tab" cheat, which is
   now fixed (see the round-token architecture note above) — this issue
   is about scripted abuse of the (now-validating) endpoints themselves,
   not passive reading.
5. No automated tests and no CI workflow in this repo.

## User preferences

_Populate as you build — explicit user instructions worth remembering
across sessions._

## Pointers

- `DEPLOY.md` — Vercel + Render production topology, local dev setup.
- `render.yaml` — backend infra-as-code (Render Blueprint).
- `artifacts/logo-rush/vercel.json` — frontend build/rewrite config.
- `replit.md` — Replit-specific run commands and product summary.
- `.agents/memory/` — prior agent session notes (Brandfetch API usage,
  etc.).
