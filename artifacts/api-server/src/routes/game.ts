import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, logoReportsTable, soloScoresTable, type CatalogItem } from "@workspace/db";
import {
  GetSoloLeaderboardQueryParams,
  GetSoloLeaderboardResponse,
  ListSoloLogosResponse,
  ListSoloRoundsQueryParams,
  ListSoloRoundsResponse,
  ListThemesResponse,
  ReportLogoBody,
  ReportLogoResponse,
  RevealSoloRoundBody,
  RevealSoloRoundResponse,
  SubmitSoloGuessBody,
  SubmitSoloGuessResponse,
  SubmitSoloScoreBody,
  SubmitSoloScoreResponse,
} from "@workspace/api-zod";
import { findCatalogItem, getCatalogItems, getPublicRooms, getStats, getThemeById, getThemes, matchesGuess, pickAnswer } from "../game";
import { toClientImageUrl } from "../image-providers";
import { signLogoToken, verifyLogoToken } from "../logo-token";

const gameRouter: IRouter = Router();

function findItemByToken(token: unknown): { item: CatalogItem; themeId: string } | undefined {
  const payload = verifyLogoToken(token);
  if (!payload) return undefined;
  const item = findCatalogItem(payload.itemId);
  return item ? { item, themeId: payload.themeId } : undefined;
}

const asLocale = (value: unknown): "fr" | "en" => (value === "en" ? "en" : "fr");

gameRouter.get("/game/stats", (_req, res) => res.json(getStats()));
gameRouter.get("/game/rooms", (_req, res) => res.json(getPublicRooms()));
gameRouter.get("/game/themes", (_req, res) => res.json(ListThemesResponse.parse(getThemes())));

// Full catalog dump across every theme: only the internal, unauthenticated
// /logo-audit QA tool reads this — a different, deliberately-unauthenticated
// consumer, never used by actual gameplay. See AGENTS.md.
gameRouter.get("/game/logos", (_req, res) => {
  const items = getCatalogItems().map((item) => ({
    id: item.id,
    themeId: item.themeId,
    answerFr: item.answerFr,
    answerEn: item.answerEn,
    aliasesFr: item.aliasesFr,
    aliasesEn: item.aliasesEn,
    category: item.category ?? undefined,
    difficulty: item.difficulty,
    imageUrl: toClientImageUrl(getThemeById(item.themeId), item.imageRef),
  }));
  res.json(ListSoloLogosResponse.parse(items));
});

// Playable solo round pool: unlike /game/logos above (an internal catalog
// dump used by the unauthenticated /logo-audit QA tool), this never
// includes `answer`/`aliases` — the id itself is an answer slug, so even the
// id is replaced by an opaque per-round token. See /game/solo/guess and
// /game/solo/reveal, which resolve the token server-side.
//
// `imageUrl` is NOT proxied through this server — see image-providers.ts
// for why (Brandfetch's CDN blocks non-browser requests; the other
// providers' imageRef is already a direct URL that doesn't need hiding).
gameRouter.get("/game/solo/logos", (req, res): void => {
  const params = ListSoloRoundsQueryParams.safeParse({ themeId: req.query.themeId });
  if (!params.success) {
    res.status(400).json({ error: "Thème invalide." });
    return;
  }
  const theme = getThemeById(params.data.themeId);
  const rounds = getCatalogItems()
    .filter((item) => item.themeId === params.data.themeId)
    .map((item) => {
      const token = signLogoToken({ itemId: item.id, themeId: item.themeId });
      return { token, themeId: item.themeId, category: item.category ?? undefined, difficulty: item.difficulty, imageUrl: toClientImageUrl(theme, item.imageRef) };
    });
  res.json(ListSoloRoundsResponse.parse(rounds));
});

gameRouter.post("/game/solo/guess", (req, res): void => {
  const input = SubmitSoloGuessBody.safeParse(req.body);
  const found = input.success ? findItemByToken(input.data.token) : undefined;
  if (!input.success || !found) {
    res.status(400).json({ error: "Manche invalide." });
    return;
  }
  const correct = matchesGuess(found.item, input.data.guess);
  res.json(SubmitSoloGuessResponse.parse(correct ? { correct: true, answer: pickAnswer(found.item, asLocale(input.data.locale)) } : { correct: false }));
});

gameRouter.post("/game/solo/reveal", (req, res): void => {
  const input = RevealSoloRoundBody.safeParse(req.body);
  const found = input.success ? findItemByToken(input.data.token) : undefined;
  if (!input.success || !found) {
    res.status(400).json({ error: "Manche invalide." });
    return;
  }
  res.json(RevealSoloRoundResponse.parse({ answer: pickAnswer(found.item, asLocale(input.data.locale)) }));
});

gameRouter.get("/game/solo-leaderboard", async (req, res): Promise<void> => {
  const params = GetSoloLeaderboardQueryParams.safeParse({
    themeId: req.query.themeId,
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
        eq(soloScoresTable.themeId, params.data.themeId),
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
    themeId: input.data.themeId,
    roundCount: input.data.roundCount,
    roundDuration: input.data.roundDuration,
  });
  const entries = await db
    .select()
    .from(soloScoresTable)
    .where(
      and(
        eq(soloScoresTable.themeId, input.data.themeId),
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
  const found = input.success ? findItemByToken(input.data.logoId) : undefined;
  if (!input.success || !found) {
    res.status(400).json({ error: "Signalement invalide." });
    return;
  }
  await db.insert(logoReportsTable).values({
    logoId: found.item.id,
    themeId: found.item.themeId,
    logoAnswer: pickAnswer(found.item, "fr"),
    reason: input.data.reason,
  });
  res.status(201).json(ReportLogoResponse.parse({ ok: true }));
});

export default gameRouter;
