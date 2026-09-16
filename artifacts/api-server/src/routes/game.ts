import { Router, type IRouter } from "express";
import { getPublicRooms, getStats, logos } from "../game";

const gameRouter: IRouter = Router();

gameRouter.get("/game/stats", (_req, res) => res.json(getStats()));
gameRouter.get("/game/rooms", (_req, res) => res.json(getPublicRooms()));
gameRouter.get("/game/logos", (_req, res) => res.json(logos));
gameRouter.get("/game/logos/:logoId/image", async (req, res) => {
  const logo = logos.find((item) => item.id === req.params.logoId);
  if (!logo) return res.status(404).json({ error: "Logo inconnu." });
  const clientId = process.env.BRANDFETCH_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: "Brandfetch n'est pas configuré." });
  try {
    const url = `https://cdn.brandfetch.io/domain/${encodeURIComponent(logo.domain)}/w/512/h/512/fallback/lettermark?c=${encodeURIComponent(clientId)}`;
    const response = await fetch(url);
    if (!response.ok) {
      req.log.warn({ upstreamStatus: response.status, logoId: logo.id }, "Brandfetch logo not available");
      return res.status(502).json({ error: "Brandfetch n'a pas retourné ce logo." });
    }
    const body = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "no-store");
    return res.send(body);
  } catch (error) {
    req.log.error({ error, logoId: logo.id }, "Brandfetch logo request failed");
    return res.status(502).json({ error: "Impossible de charger le logo Brandfetch." });
  }
});

export default gameRouter;