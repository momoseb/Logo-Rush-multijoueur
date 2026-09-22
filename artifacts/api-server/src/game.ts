import type { Server, Socket } from "socket.io";
import { eq } from "drizzle-orm";
import { db, soloScoresTable, themesTable, catalogItemsTable, type Theme, type CatalogItem } from "@workspace/db";
import { logger } from "./lib/logger";
import { signLogoToken } from "./logo-token";

type Player = {
  id: string;
  sessionId: string;
  socketId: string;
  nickname: string;
  score: number;
  foundAt?: number;
  roundPoints: number;
  connected: boolean;
};

type Room = {
  code: string;
  name: string;
  hostId: string;
  themeId: string;
  isPublic: boolean;
  maxPlayers: number;
  roundCount: number;
  roundDuration: number;
  status: "waiting" | "playing" | "results";
  players: Player[];
  itemOrder: string[];
  roundIndex: number;
  roundStartedAt?: number;
  roundTimer?: NodeJS.Timeout;
  nextTimer?: NodeJS.Timeout;
  lastActiveAt: number;
};

// In-memory catalog cache, loaded from the `themes`/`catalog_items` tables
// (see lib/db/src/schema/) once at startup and refreshable on demand (the
// admin catalog editor calls refreshCatalog() after writes). Rooms read
// synchronously from this cache on every round/guess — the DB is only hit
// through loadCatalog(), never on the hot gameplay path.
let themes: Theme[] = [];
let catalogItems: CatalogItem[] = [];

export async function loadCatalog() {
  themes = await db.select().from(themesTable);
  catalogItems = await db.select().from(catalogItemsTable).where(eq(catalogItemsTable.active, true));
}
export const refreshCatalog = loadCatalog;

export const getThemes = () => themes.filter((t) => t.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
export const getThemeById = (themeId: string) => themes.find((t) => t.id === themeId);
const itemsForTheme = (themeId: string) => catalogItems.filter((item) => item.themeId === themeId);
export const getCatalogItems = () => catalogItems;
export const findCatalogItem = (itemId: string) => catalogItems.find((item) => item.id === itemId);

const DEFAULT_THEME_ID = "brands";
const resolveThemeId = (requested: unknown) => {
  const id = String(requested || DEFAULT_THEME_ID);
  return getThemes().some((theme) => theme.id === id) ? id : DEFAULT_THEME_ID;
};

export const pickAnswer = (item: CatalogItem, locale: "fr" | "en") =>
  (locale === "en" ? item.answerEn : item.answerFr) || item.answerFr || item.answerEn;

const clean = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ'’\s._-]/g, "");
export { clean };

// Accepts a guess regardless of the player's interface language: the union
// of both locales' answer + aliases, not just the one matching the
// requesting client's own `locale`. See the multi-theme/i18n plan — this is
// a deliberate leniency choice, not an oversight.
export const matchesGuess = (item: CatalogItem, guess: string) => {
  const candidates = [item.answerFr, item.answerEn, ...item.aliasesFr, ...item.aliasesEn];
  const normalizedGuess = clean(guess);
  return candidates.some((candidate) => clean(candidate) === normalizedGuess);
};

const rooms = new Map<string, Room>();
let ioRef: Server | undefined;
const leaderboardRoundCounts = new Set([5, 10, 15, 20]);
const leaderboardRoundDurations = new Set([15, 20, 30]);

const randomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const publicRoom = (room: Room) => ({
  code: room.code,
  name: room.name,
  themeId: room.themeId,
  hostName: room.players.find((p) => p.id === room.hostId)?.nickname ?? "Hôte",
  playerCount: room.players.filter((p) => p.connected).length,
  maxPlayers: room.maxPlayers,
  roundCount: room.roundCount,
  roundDuration: room.roundDuration,
  status: room.status === "waiting" ? "waiting" : "playing",
});
const roomView = (room: Room) => ({
  ...publicRoom(room),
  isPublic: room.isPublic,
  hostId: room.hostId,
  roundIndex: room.roundIndex,
  // Never broadcast sessionId to other players: it's how `room:join` matches
  // a reconnecting socket back to its player slot, so leaking it would let
  // anyone in the room reconnect as (i.e. hijack) another player.
  players: room.players.map(({ socketId: _socketId, sessionId: _sessionId, ...player }) => player),
});

export const getStats = () => ({
  playersOnline: ioRef
    ? new Set(
        [...ioRef.sockets.sockets.values()].map((socket) =>
          String(socket.data.sessionId || socket.id),
        ),
      ).size
    : 0,
  publicRooms: [...rooms.values()].filter((r) => r.isPublic && r.status === "waiting").length,
  gamesInProgress: [...rooms.values()].filter((r) => r.status === "playing").length,
});
export const getPublicRooms = () => [...rooms.values()].filter((r) => r.isPublic && r.status === "waiting").map(publicRoom);

function broadcastRooms() {
  ioRef?.emit("rooms:update", getPublicRooms());
  ioRef?.emit("stats:update", getStats());
}

async function saveMultiplayerScores(room: Room) {
  if (!leaderboardRoundCounts.has(room.roundCount) || !leaderboardRoundDurations.has(room.roundDuration)) return;
  try {
    await db.insert(soloScoresTable).values(
      room.players.map((player) => ({
        nickname: player.nickname,
        score: player.score,
        themeId: room.themeId,
        roundCount: room.roundCount,
        roundDuration: room.roundDuration,
      })),
    );
  } catch (error) {
    logger.error({ error, roomCode: room.code }, "Unable to save multiplayer leaderboard scores");
  }
}

const currentItem = (room: Room) => findCatalogItem(room.itemOrder[room.roundIndex % room.itemOrder.length]!);

function finishRound(room: Room) {
  if (room.status !== "playing") return;
  if (room.roundTimer) clearTimeout(room.roundTimer);
  const item = currentItem(room);
  ioRef?.to(room.code).emit("round:end", {
    // Multiplayer broadcasts one answer to the whole room, so it can't be
    // localized per-player the way solo's reveal/guess responses are —
    // always French here. See the i18n plan for why this is an accepted
    // scope simplification rather than an oversight.
    answer: item ? pickAnswer(item, "fr") : "",
    players: room.players.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, foundAt: p.foundAt, roundPoints: p.roundPoints })).sort((a, b) => (b.roundPoints - a.roundPoints)),
  });
  room.nextTimer = setTimeout(async () => {
    if (room.roundIndex + 1 >= room.roundCount) {
      room.status = "results";
      await saveMultiplayerScores(room);
      ioRef?.to(room.code).emit("game:end", roomView(room));
      return;
    }
    room.roundIndex += 1;
    startRound(room);
  }, 4000);
}

function startRound(room: Room) {
  room.roundStartedAt = Date.now() + 1200;
  room.players.forEach((p) => { p.foundAt = undefined; p.roundPoints = 0; });
  const item = currentItem(room);
  if (!item) return;
  // Never ship the catalog item id to clients before the round ends: the id
  // is an answer slug (e.g. "brands:louisvuitton"), so it would show up
  // verbatim in this socket frame's payload if someone opened the browser's
  // Network tab. Only an opaque, per-round signed token goes out;
  // `/api/game/logo-image/:token` resolves it server-side to fetch the real
  // image.
  const token = signLogoToken({ itemId: item.id, themeId: room.themeId });
  ioRef?.to(room.code).emit("round:start", {
    roundIndex: room.roundIndex,
    roundCount: room.roundCount,
    duration: room.roundDuration,
    startedAt: room.roundStartedAt,
    logo: { token, imageUrl: `logotoken://${token}`, category: item.category ?? undefined, difficulty: item.difficulty },
    players: roomView(room).players,
  });
  room.roundTimer = setTimeout(() => finishRound(room), room.roundDuration * 1000 + 1200);
}

function findRoomForSocket(socket: Socket) {
  return [...rooms.values()].find((room) => room.players.some((p) => p.socketId === socket.id));
}

function shuffledItemIds(themeId: string) {
  return itemsForTheme(themeId)
    .map((item) => item.id)
    .sort(() => Math.random() - 0.5);
}

export async function attachGameServer(io: Server) {
  await loadCatalog();
  ioRef = io;
  io.on("connection", (socket) => {
    broadcastRooms();
    socket.on("presence:identify", (input) => {
      const sessionId = String(input?.sessionId || "").slice(0, 100);
      if (!sessionId) return;
      socket.data.sessionId = sessionId;
      broadcastRooms();
    });
    socket.on("room:create", (input, callback) => {
      const themeId = resolveThemeId(input?.themeId);
      const itemOrder = shuffledItemIds(themeId);
      if (itemOrder.length === 0) return callback?.({ ok: false, error: "Ce thème n'a pas encore de contenu." });
      const code = randomCode();
      const playerId = crypto.randomUUID();
      const room: Room = {
        code,
        name: String(input?.name || "Salon sans nom").slice(0, 32),
        hostId: playerId,
        themeId,
        isPublic: input?.isPublic !== false,
        maxPlayers: Math.min(10, Math.max(2, Number(input?.maxPlayers) || 6)),
        roundCount: Math.min(20, Math.max(1, Number(input?.roundCount) || 5)),
        roundDuration: Math.min(30, Math.max(10, Number(input?.roundDuration) || 20)),
        status: "waiting",
        players: [{ id: playerId, sessionId: String(input?.sessionId || crypto.randomUUID()), socketId: socket.id, nickname: String(input?.nickname || "Joueur").slice(0, 20), score: 0, roundPoints: 0, connected: true }],
        itemOrder,
        roundIndex: 0,
        lastActiveAt: Date.now(),
      };
      rooms.set(code, room);
      socket.data.sessionId = room.players[0]?.sessionId;
      socket.join(code);
      callback?.({ ok: true, room: roomView(room), playerId });
      io.to(code).emit("room:update", roomView(room));
      broadcastRooms();
    });

    socket.on("room:join", (input, callback) => {
      const code = String(input?.code || "").toUpperCase();
      const room = rooms.get(code);
      if (!room || room.status !== "waiting") return callback?.({ ok: false, error: "Salon introuvable ou déjà en jeu." });
      const sessionId = String(input?.sessionId || crypto.randomUUID());
      let player = room.players.find((p) => p.sessionId === sessionId);
      if (!player && room.players.filter((p) => p.connected).length >= room.maxPlayers) return callback?.({ ok: false, error: "Ce salon est complet." });
      if (player) Object.assign(player, { socketId: socket.id, connected: true, nickname: String(input?.nickname || player.nickname).slice(0, 20) });
      else {
        player = { id: crypto.randomUUID(), sessionId, socketId: socket.id, nickname: String(input?.nickname || "Joueur").slice(0, 20), score: 0, roundPoints: 0, connected: true };
        room.players.push(player);
      }
      socket.data.sessionId = sessionId;
      socket.join(code);
      room.lastActiveAt = Date.now();
      callback?.({ ok: true, room: roomView(room), playerId: player.id });
      io.to(code).emit("room:update", roomView(room));
      broadcastRooms();
    });

    socket.on("game:start", () => {
      const room = findRoomForSocket(socket);
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || player?.id !== room.hostId || room.status === "playing") return;
      room.status = "playing";
      room.roundIndex = 0;
      room.players.forEach((p) => { p.score = 0; });
      room.itemOrder = shuffledItemIds(room.themeId);
      io.to(room.code).emit("game:start", roomView(room));
      startRound(room);
      broadcastRooms();
    });

    socket.on("game:restart", () => {
      const room = findRoomForSocket(socket);
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || player?.id !== room.hostId || room.status !== "results") return;
      room.status = "waiting";
      room.roundIndex = 0;
      room.players.forEach((p) => { p.score = 0; p.foundAt = undefined; p.roundPoints = 0; });
      room.lastActiveAt = Date.now();
      io.to(room.code).emit("room:update", roomView(room));
      broadcastRooms();
    });

    socket.on("room:settings", (input, callback) => {
      const room = findRoomForSocket(socket);
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || player?.id !== room.hostId || room.status !== "waiting") {
        return callback?.({ ok: false, error: "Seul l'hôte peut modifier les réglages avant la partie." });
      }
      if (input?.themeId !== undefined) room.themeId = resolveThemeId(input.themeId);
      room.roundCount = Math.min(20, Math.max(1, Number(input?.roundCount) || room.roundCount));
      room.roundDuration = Math.min(30, Math.max(10, Number(input?.roundDuration) || room.roundDuration));
      room.lastActiveAt = Date.now();
      io.to(room.code).emit("room:update", roomView(room));
      broadcastRooms();
      callback?.({ ok: true });
    });

    socket.on("guess:submit", (input, callback) => {
      const room = findRoomForSocket(socket);
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || !player || room.status !== "playing" || player.foundAt !== undefined || !room.roundStartedAt) return;
      const item = currentItem(room);
      if (!item || !matchesGuess(item, String(input?.guess || ""))) return callback?.({ correct: false });
      const elapsed = Math.max(0, Date.now() - room.roundStartedAt);
      const points = Math.max(100, Math.round(1000 * (1 - elapsed / (room.roundDuration * 1000))));
      player.foundAt = elapsed;
      player.roundPoints = points;
      player.score += points;
      const rank = room.players.filter((p) => p.foundAt !== undefined).length;
      callback?.({ correct: true, points, rank });
      io.to(room.code).emit("player:found", { playerId: player.id, nickname: player.nickname, elapsed, points, rank, players: roomView(room).players });
      if (room.players.filter((p) => p.connected).every((p) => p.foundAt !== undefined)) finishRound(room);
    });

    const leaveRoom = (room: Room) => {
      const player = room.players.find((p) => p.socketId === socket.id);
      if (player) player.connected = false;
      const nextHost = room.players.find((p) => p.connected);
      if (player?.id === room.hostId && nextHost) room.hostId = nextHost.id;
      if (!nextHost) {
        if (room.roundTimer) clearTimeout(room.roundTimer);
        if (room.nextTimer) clearTimeout(room.nextTimer);
        rooms.delete(room.code);
      } else io.to(room.code).emit("room:update", roomView(room));
      broadcastRooms();
    };

    // Only leave the socket.io room, not the whole connection: this socket is a
    // long-lived singleton shared by the entire app (presence, live stats), so
    // disconnecting it here would needlessly tear down and reconnect it every
    // time a player simply navigates away from a room.
    socket.on("room:leave", ({ code }: { code?: string } = {}) => {
      const room = (code && rooms.get(String(code).toUpperCase())) || findRoomForSocket(socket);
      if (!room) return;
      socket.leave(room.code);
      leaveRoom(room);
    });
    socket.on("disconnect", () => {
      const room = findRoomForSocket(socket);
      if (!room) return broadcastRooms();
      leaveRoom(room);
    });
  });
  setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [code, room] of rooms) if (room.lastActiveAt < cutoff && !room.players.some((p) => p.connected)) rooms.delete(code);
  }, 60_000).unref();
  logger.info("Logo Rush realtime game server attached");
}
