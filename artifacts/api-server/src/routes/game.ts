import { Router, type IRouter } from "express";
import { getPublicRooms, getStats, logos } from "../game";

const gameRouter: IRouter = Router();

gameRouter.get("/game/stats", (_req, res) => res.json(getStats()));
gameRouter.get("/game/rooms", (_req, res) => res.json(getPublicRooms()));
gameRouter.get("/game/logos", (_req, res) => res.json(logos));

export default gameRouter;