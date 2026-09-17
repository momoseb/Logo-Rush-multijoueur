import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, soloScoresTable } from "@workspace/db";
import {
  GetSoloLeaderboardQueryParams,
  GetSoloLeaderboardResponse,
  SubmitSoloScoreBody,
  SubmitSoloScoreResponse,
} from "@workspace/api-zod";
import { getPublicRooms, getStats, logos } from "../game";

const gameRouter: IRouter = Router();

gameRouter.get("/game/stats", (_req, res) => res.json(getStats()));
gameRouter.get("/game/rooms", (_req, res) => res.json(getPublicRooms()));
gameRouter.get("/game/logos", (_req, res) => res.json(logos));
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

export default gameRouter;