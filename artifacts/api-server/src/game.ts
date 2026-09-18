import type { Server, Socket } from "socket.io";
import { db, soloScoresTable } from "@workspace/db";
import { logger } from "./lib/logger";
import { additionalLogos, correctedLogoDomain } from "./logo-catalog";

export type Logo = {
  id: string;
  domain: string;
  answer: string;
  aliases: string[];
  category: string;
  difficulty: "easy" | "medium" | "hard";
  imageUrl: string;
};

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
  isPublic: boolean;
  maxPlayers: number;
  roundCount: number;
  roundDuration: number;
  status: "waiting" | "playing" | "results";
  players: Player[];
  logoOrder: number[];
  roundIndex: number;
  roundStartedAt?: number;
  roundTimer?: NodeJS.Timeout;
  nextTimer?: NodeJS.Timeout;
  lastActiveAt: number;
};

export const logos: Logo[] = [
  { id: "apple", domain: "apple.com", answer: "Apple", aliases: ["apple inc"], category: "technologie", difficulty: "easy", imageUrl: "brandfetch://apple.com" },
  { id: "nike", domain: "nike.com", answer: "Nike", aliases: ["nike inc"], category: "sport", difficulty: "easy", imageUrl: "brandfetch://nike.com" },
  { id: "cocacola", domain: "coca-cola.com", answer: "Coca-Cola", aliases: ["coca cola", "cocacola", "coke"], category: "alimentation", difficulty: "easy", imageUrl: "brandfetch://coca-cola.com" },
  { id: "mcdonalds", domain: "mcdonalds.com", answer: "McDonald's", aliases: ["mcdonalds", "macdonalds", "mcdo"], category: "alimentation", difficulty: "easy", imageUrl: "brandfetch://mcdonalds.com" },
  { id: "adidas", domain: "adidas.com", answer: "Adidas", aliases: [], category: "sport", difficulty: "easy", imageUrl: "brandfetch://adidas.com" },
  { id: "tesla", domain: "tesla.com", answer: "Tesla", aliases: ["tesla motors"], category: "automobile", difficulty: "easy", imageUrl: "brandfetch://tesla.com" },
  { id: "spotify", domain: "spotify.com", answer: "Spotify", aliases: [], category: "technologie", difficulty: "easy", imageUrl: "brandfetch://spotify.com" },
  { id: "netflix", domain: "netflix.com", answer: "Netflix", aliases: [], category: "cinéma", difficulty: "easy", imageUrl: "brandfetch://netflix.com" },
  { id: "amazon", domain: "amazon.com", answer: "Amazon", aliases: ["amazon.com"], category: "technologie", difficulty: "medium", imageUrl: "brandfetch://amazon.com" },
  { id: "microsoft", domain: "microsoft.com", answer: "Microsoft", aliases: ["microsoft corporation"], category: "technologie", difficulty: "easy", imageUrl: "brandfetch://microsoft.com" },
  { id: "google", domain: "google.com", answer: "Google", aliases: [], category: "technologie", difficulty: "easy", imageUrl: "brandfetch://google.com" },
  { id: "samsung", domain: "samsung.com", answer: "Samsung", aliases: ["samsung electronics"], category: "technologie", difficulty: "medium", imageUrl: "brandfetch://samsung.com" },
  { id: "lego", domain: "lego.com", answer: "LEGO", aliases: ["the lego group"], category: "jeux vidéo", difficulty: "easy", imageUrl: "brandfetch://lego.com" },
  { id: "pepsi", domain: "pepsi.com", answer: "Pepsi", aliases: ["pepsi cola"], category: "alimentation", difficulty: "medium", imageUrl: "brandfetch://pepsi.com" },
  { id: "starbucks", domain: "starbucks.com", answer: "Starbucks", aliases: ["starbucks coffee"], category: "alimentation", difficulty: "medium", imageUrl: "brandfetch://starbucks.com" },
  { id: "ferrari", domain: "ferrari.com", answer: "Ferrari", aliases: ["scuderia ferrari"], category: "automobile", difficulty: "medium", imageUrl: "brandfetch://ferrari.com" },
  { id: "bmw", domain: "bmw.com", answer: "BMW", aliases: ["bayerische motoren werke"], category: "automobile", difficulty: "easy", imageUrl: "brandfetch://bmw.com" },
  { id: "mercedes", domain: "mercedes-benz.com", answer: "Mercedes-Benz", aliases: ["mercedes", "mercedes benz"], category: "automobile", difficulty: "easy", imageUrl: "brandfetch://mercedes-benz.com" },
  { id: "audi", domain: "audi.com", answer: "Audi", aliases: [], category: "automobile", difficulty: "easy", imageUrl: "brandfetch://audi.com" },
  { id: "volkswagen", domain: "volkswagen.com", answer: "Volkswagen", aliases: ["vw"], category: "automobile", difficulty: "easy", imageUrl: "brandfetch://volkswagen.com" },
  { id: "toyota", domain: "toyota.com", answer: "Toyota", aliases: [], category: "automobile", difficulty: "easy", imageUrl: "brandfetch://toyota.com" },
  { id: "honda", domain: "honda.com", answer: "Honda", aliases: [], category: "automobile", difficulty: "medium", imageUrl: "brandfetch://honda.com" },
  { id: "ford", domain: "ford.com", answer: "Ford", aliases: ["ford motor company"], category: "automobile", difficulty: "easy", imageUrl: "brandfetch://ford.com" },
  { id: "porsche", domain: "porsche.com", answer: "Porsche", aliases: [], category: "automobile", difficulty: "medium", imageUrl: "brandfetch://porsche.com" },
  { id: "renault", domain: "renault.co.uk", answer: "Renault", aliases: [], category: "automobile", difficulty: "easy", imageUrl: "brandfetch://renault.co.uk" },
  { id: "louisvuitton", domain: "louisvuitton.com", answer: "Louis Vuitton", aliases: ["louis vuitton", "lv"], category: "mode", difficulty: "easy", imageUrl: "brandfetch://louisvuitton.com" },
  { id: "chanel", domain: "chanel.com", answer: "Chanel", aliases: [], category: "mode", difficulty: "easy", imageUrl: "brandfetch://chanel.com" },
  { id: "gucci", domain: "gucci.com", answer: "Gucci", aliases: [], category: "mode", difficulty: "easy", imageUrl: "brandfetch://gucci.com" },
  { id: "ikea", domain: "ikea.com", answer: "IKEA", aliases: [], category: "distribution", difficulty: "easy", imageUrl: "brandfetch://ikea.com" },
  { id: "walmart", domain: "walmart.com", answer: "Walmart", aliases: ["wal-mart"], category: "distribution", difficulty: "medium", imageUrl: "brandfetch://walmart.com" },
  { id: "disney", domain: "disney.com", answer: "Disney", aliases: ["walt disney", "the walt disney company"], category: "divertissement", difficulty: "easy", imageUrl: "brandfetch://disney.com" },
  { id: "youtube", domain: "youtube.com", answer: "YouTube", aliases: ["you tube"], category: "technologie", difficulty: "easy", imageUrl: "brandfetch://youtube.com" },
  { id: "instagram", domain: "instagram.com", answer: "Instagram", aliases: ["insta"], category: "technologie", difficulty: "easy", imageUrl: "brandfetch://instagram.com" },
  { id: "tiktok", domain: "tiktok.com", answer: "TikTok", aliases: ["tik tok"], category: "technologie", difficulty: "easy", imageUrl: "brandfetch://tiktok.com" },
  { id: "airbnb", domain: "airbnb.com", answer: "Airbnb", aliases: ["air bnb"], category: "voyage", difficulty: "medium", imageUrl: "brandfetch://airbnb.com" },
  { id: "uber", domain: "uber.com", answer: "Uber", aliases: [], category: "transport", difficulty: "easy", imageUrl: "brandfetch://uber.com" },
  { id: "paypal", domain: "paypal.com", answer: "PayPal", aliases: ["pay pal"], category: "finance", difficulty: "easy", imageUrl: "brandfetch://paypal.com" },
  { id: "visa", domain: "visa.com", answer: "Visa", aliases: [], category: "finance", difficulty: "easy", imageUrl: "brandfetch://visa.com" },
  { id: "mastercard", domain: "mastercard.com", answer: "Mastercard", aliases: ["master card"], category: "finance", difficulty: "easy", imageUrl: "brandfetch://mastercard.com" },
  { id: "intel", domain: "intel.com", answer: "Intel", aliases: ["intel corporation"], category: "technologie", difficulty: "medium", imageUrl: "brandfetch://intel.com" },
  { id: "playstation", domain: "playstation.com", answer: "PlayStation", aliases: ["play station", "ps"], category: "jeux vidéo", difficulty: "easy", imageUrl: "brandfetch://playstation.com" },
  { id: "xbox", domain: "xbox.com", answer: "Xbox", aliases: ["x box"], category: "jeux vidéo", difficulty: "easy", imageUrl: "brandfetch://xbox.com" },
  { id: "nintendo", domain: "nintendo.com", answer: "Nintendo", aliases: [], category: "jeux vidéo", difficulty: "easy", imageUrl: "brandfetch://nintendo.com" },
  { id: "kfc", domain: "kfc.com", answer: "KFC", aliases: ["kentucky fried chicken"], category: "alimentation", difficulty: "easy", imageUrl: "brandfetch://kfc.com" },
  { id: "burgerking", domain: correctedLogoDomain("burgerking.com"), answer: "Burger King", aliases: ["burgerking", "bk"], category: "alimentation", difficulty: "easy", imageUrl: `brandfetch://${correctedLogoDomain("burgerking.com")}` },
  { id: "redbull", domain: "redbull.com", answer: "Red Bull", aliases: ["redbull"], category: "alimentation", difficulty: "easy", imageUrl: "brandfetch://redbull.com" },
  { id: "lacoste", domain: "lacoste.com", answer: "Lacoste", aliases: [], category: "mode", difficulty: "easy", imageUrl: "brandfetch://lacoste.com" },
  { id: "puma", domain: "puma.com", answer: "Puma", aliases: [], category: "sport", difficulty: "easy", imageUrl: "brandfetch://puma.com" },
  { id: "shell", domain: "shell.com", answer: "Shell", aliases: ["royal dutch shell"], category: "énergie", difficulty: "medium", imageUrl: "brandfetch://shell.com" },
  { id: "rolex", domain: "rolex.com", answer: "Rolex", aliases: [], category: "mode", difficulty: "medium", imageUrl: "brandfetch://rolex.com" },
  ...additionalLogos,
];

const rooms = new Map<string, Room>();
let ioRef: Server | undefined;
const leaderboardRoundCounts = new Set([5, 10, 15, 20]);
const leaderboardRoundDurations = new Set([15, 20, 30]);

const clean = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f'’\s._-]/g, "");
const randomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const publicRoom = (room: Room) => ({
  code: room.code,
  name: room.name,
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
  players: room.players.map(({ socketId: _socketId, ...player }) => player),
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
        roundCount: room.roundCount,
        roundDuration: room.roundDuration,
      })),
    );
  } catch (error) {
    logger.error({ error, roomCode: room.code }, "Unable to save multiplayer leaderboard scores");
  }
}

function finishRound(room: Room) {
  if (room.status !== "playing") return;
  if (room.roundTimer) clearTimeout(room.roundTimer);
  const logo = logos[room.logoOrder[room.roundIndex] % logos.length]!;
  ioRef?.to(room.code).emit("round:end", {
    answer: logo.answer,
    imageUrl: logo.imageUrl,
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
  const logo = logos[room.logoOrder[room.roundIndex] % logos.length]!;
  ioRef?.to(room.code).emit("round:start", {
    roundIndex: room.roundIndex,
    roundCount: room.roundCount,
    duration: room.roundDuration,
    startedAt: room.roundStartedAt,
    logo: { id: logo.id, imageUrl: logo.imageUrl, category: logo.category, difficulty: logo.difficulty },
    players: roomView(room).players,
  });
  room.roundTimer = setTimeout(() => finishRound(room), room.roundDuration * 1000 + 1200);
}

function findRoomForSocket(socket: Socket) {
  return [...rooms.values()].find((room) => room.players.some((p) => p.socketId === socket.id));
}

export function attachGameServer(io: Server) {
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
      const code = randomCode();
      const playerId = crypto.randomUUID();
      const room: Room = {
        code,
        name: String(input?.name || "Salon sans nom").slice(0, 32),
        hostId: playerId,
        isPublic: input?.isPublic !== false,
        maxPlayers: Math.min(10, Math.max(2, Number(input?.maxPlayers) || 6)),
        roundCount: Math.min(20, Math.max(1, Number(input?.roundCount) || 5)),
        roundDuration: Math.min(30, Math.max(10, Number(input?.roundDuration) || 20)),
        status: "waiting",
        players: [{ id: playerId, sessionId: String(input?.sessionId || crypto.randomUUID()), socketId: socket.id, nickname: String(input?.nickname || "Joueur").slice(0, 20), score: 0, roundPoints: 0, connected: true }],
        logoOrder: [...logos.keys()].sort(() => Math.random() - 0.5),
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
      room.logoOrder = [...logos.keys()].sort(() => Math.random() - 0.5);
      io.to(room.code).emit("game:start", roomView(room));
      startRound(room);
      broadcastRooms();
    });

    socket.on("room:settings", (input, callback) => {
      const room = findRoomForSocket(socket);
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || player?.id !== room.hostId || room.status !== "waiting") {
        return callback?.({ ok: false, error: "Seul l'hôte peut modifier les réglages avant la partie." });
      }
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
      const logo = logos[room.logoOrder[room.roundIndex] % logos.length]!;
      const correct = [logo.answer, ...logo.aliases].some((answer) => clean(answer) === clean(String(input?.guess || "")));
      if (!correct) return callback?.({ correct: false });
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
