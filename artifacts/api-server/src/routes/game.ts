import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, logoReportsTable, soloScoresTable } from "@workspace/db";
import {
  GetSoloLeaderboardQueryParams,
  GetSoloLeaderboardResponse,
  ListSoloRoundsResponse,
  ReportLogoBody,
  ReportLogoResponse,
  RevealSoloRoundBody,
  RevealSoloRoundResponse,
  SubmitSoloGuessBody,
  SubmitSoloGuessResponse,
  SubmitSoloScoreBody,
  SubmitSoloScoreResponse,
} from "@workspace/api-zod";
import { clean, getPublicRooms, getStats, logos } from "../game";
import { signLogoToken, verifyLogoToken } from "../logo-token";
import { logger } from "../lib/logger";

const gameRouter: IRouter = Router();

const BRANDFETCH_CDN_CLIENT_ID = process.env.BRANDFETCH_CLIENT_ID || "1idke8AlkDn4BHhX1fs";

function findLogoByToken(token: unknown) {
  const logoId = verifyLogoToken(token);
  return logoId ? logos.find((candidate) => candidate.id === logoId) : undefined;
}

gameRouter.get("/game/stats", (_req, res) => res.json(getStats()));
gameRouter.get("/game/rooms", (_req, res) => res.json(getPublicRooms()));
gameRouter.get("/game/logos", (_req, res) => res.json(logos));

// Playable solo round pool: unlike /game/logos above (an internal catalog
// dump used by the unauthenticated /logo-audit QA tool), this never
// includes `answer`/`aliases` — the id itself is an answer slug, so even the
// id is replaced by an opaque per-round token. See /game/solo/guess and
// /game/solo/reveal, which resolve the token server-side.
gameRouter.get("/game/solo/logos", (_req, res) => {
  const rounds = logos.map((logo) => {
    const token = signLogoToken(logo.id);
    return { token, category: logo.category, difficulty: logo.difficulty, imageUrl: `logotoken://${token}` };
  });
  res.json(ListSoloRoundsResponse.parse(rounds));
});

gameRouter.post("/game/solo/guess", (req, res): void => {
  const input = SubmitSoloGuessBody.safeParse(req.body);
  const logo = input.success ? findLogoByToken(input.data.token) : undefined;
  if (!input.success || !logo) {
    res.status(400).json({ error: "Manche invalide." });
    return;
  }
  const correct = [logo.answer, ...logo.aliases].some((answer) => clean(answer) === clean(input.data.guess));
  res.json(SubmitSoloGuessResponse.parse(correct ? { correct: true, answer: logo.answer } : { correct: false }));
});

gameRouter.post("/game/solo/reveal", (req, res): void => {
  const input = RevealSoloRoundBody.safeParse(req.body);
  const logo = input.success ? findLogoByToken(input.data.token) : undefined;
  if (!input.success || !logo) {
    res.status(400).json({ error: "Manche invalide." });
    return;
  }
  res.json(RevealSoloRoundResponse.parse({ answer: logo.answer }));
});

gameRouter.get("/game/logo-image/:token", async (req, res): Promise<void> => {
  const logo = findLogoByToken(req.params.token);
  const domain = logo?.imageUrl.startsWith("brandfetch://") ? logo.imageUrl.slice("brandfetch://".length) : undefined;
  if (!domain) {
    res.status(404).end();
    return;
  }
  const fallback = req.query.fallback === "1" || req.query.fallback === "true";
  const upstreamUrl = `https://cdn.brandfetch.io/domain/${encodeURIComponent(domain)}/w/512/h/512/type/icon${fallback ? "/fallback/lettermark" : ""}?c=${encodeURIComponent(BRANDFETCH_CDN_CLIENT_ID)}`;
  try {
    const upstream = await fetch(upstreamUrl);
    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }
    res.setHeader("content-type", upstream.headers.get("content-type") || "image/png");
    res.setHeader("cache-control", "no-store");
    const { Readable } = await import("node:stream");
    Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream).pipe(res);
  } catch (error) {
    logger.error({ error }, "Unable to proxy logo image");
    res.status(502).end();
  }
});

gameRouter.get("/game/solo-leaderboard", async (req, res): Promise<void> => {
  const params = GetSoloLeaderboardQueryParams.safeParse({
    roundCount: Number(req.query.roundCount),
    roundDuration: Number(req.query.roundDuration),
  });
  if (!params.success) {
    res.status(400).json({ error: "Mode de jeu invalide." });
    return;
  }
  const entries = await db
    .select()
    .from(soloScoresTable)
    .where(
      and(
        eq(soloScoresTable.roundCount, params.data.roundCount),
        eq(soloScoresTable.roundDuration, params.data.roundDuration),
      ),
    )
    .orderBy(desc(soloScoresTable.score), asc(soloScoresTable.createdAt))
    .limit(5);
  res.json(GetSoloLeaderboardResponse.parse(entries));
});

gameRouter.post("/game/solo-leaderboard", async (req, res): Promise<void> => {
  const input = SubmitSoloScoreBody.safeParse(req.body);
  if (!input.success || input.data.score > input.data.roundCount * 1000) {
    res.status(400).json({ error: "Score solo invalide." });
    return;
  }
  await db.insert(soloScoresTable).values({
    nickname: input.data.nickname.trim(),
    score: input.data.score,
    roundCount: input.data.roundCount,
    roundDuration: input.data.roundDuration,
  });
  const entries = await db
    .select()
    .from(soloScoresTable)
    .where(
      and(
        eq(soloScoresTable.roundCount, input.data.roundCount),
        eq(soloScoresTable.roundDuration, input.data.roundDuration),
      ),
    )
    .orderBy(desc(soloScoresTable.score), asc(soloScoresTable.createdAt))
    .limit(5);
  res.status(201).json(SubmitSoloScoreResponse.parse(entries));
});

gameRouter.post("/game/logo-reports", async (req, res): Promise<void> => {
  // `logoId` here is actually a signed round token (see logo-token.ts), not
  // a raw catalog id — the player-facing report button never sees real ids.
  const input = ReportLogoBody.safeParse(req.body);
  const logo = input.success ? findLogoByToken(input.data.logoId) : undefined;
  if (!input.success || !logo) {
    res.status(400).json({ error: "Signalement invalide." });
    return;
  }
  await db.insert(logoReportsTable).values({
    logoId: logo.id,
    logoAnswer: logo.answer,
    reason: input.data.reason,
  });
  res.status(201).json(ReportLogoResponse.parse({ ok: true }));
});

export default gameRouter;