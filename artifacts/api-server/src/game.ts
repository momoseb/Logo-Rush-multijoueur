import type { Server, Socket } from "socket.io";
import { logger } from "./lib/logger";

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
  { id: "apple", domain: "apple.com", answer: "Apple", aliases: ["apple inc"], category: "technologie", difficulty: "easy", imageUrl: "/api/game/logos/apple/image" },
  { id: "nike", domain: "nike.com", answer: "Nike", aliases: ["nike inc"], category: "sport", difficulty: "easy", imageUrl: "/api/game/logos/nike/image" },
  { id: "cocacola", domain: "coca-cola.com", answer: "Coca-Cola", aliases: ["coca cola", "cocacola", "coke"], category: "alimentation", difficulty: "easy", imageUrl: "/api/game/logos/cocacola/image" },
  { id: "mcdonalds", domain: "mcdonalds.com", answer: "McDonald's", aliases: ["mcdonalds", "macdonalds", "mcdo"], category: "alimentation", difficulty: "easy", imageUrl: "/api/game/logos/mcdonalds/image" },
  { id: "adidas", domain: "adidas.com", answer: "Adidas", aliases: [], category: "sport", difficulty: "easy", imageUrl: "/api/game/logos/adidas/image" },
  { id: "tesla", domain: "tesla.com", answer: "Tesla", aliases: ["tesla motors"], category: "automobile", difficulty: "easy", imageUrl: "/api/game/logos/tesla/image" },
  { id: "spotify", domain: "spotify.com", answer: "Spotify", aliases: [], category: "technologie", difficulty: "easy", imageUrl: "/api/game/logos/spotify/image" },
  { id: "netflix", domain: "netflix.com", answer: "Netflix", aliases: [], category: "cinéma", difficulty: "easy", imageUrl: "/api/game/logos/netflix/image" },
  { id: "amazon", domain: "amazon.com", answer: "Amazon", aliases: ["amazon.com"], category: "technologie", difficulty: "medium", imageUrl: "/api/game/logos/amazon/image" },
  { id: "microsoft", domain: "microsoft.com", answer: "Microsoft", aliases: ["microsoft corporation"], category: "technologie", difficulty: "easy", imageUrl: "/api/game/logos/microsoft/image" },
  { id: "google", domain: "google.com", answer: "Google", aliases: [], category: "technologie", difficulty: "easy", imageUrl: "/api/game/logos/google/image" },
  { id: "samsung", domain: "samsung.com", answer: "Samsung", aliases: ["samsung electronics"], category: "technologie", difficulty: "medium", imageUrl: "/api/game/logos/samsung/image" },
  { id: "lego", domain: "lego.com", answer: "LEGO", aliases: ["the lego group"], category: "jeux vidéo", difficulty: "easy", imageUrl: "/api/game/logos/lego/image" },
  { id: "pepsi", domain: "pepsi.com", answer: "Pepsi", aliases: ["pepsi cola"], category: "alimentation", difficulty: "medium", imageUrl: "/api/game/logos/pepsi/image" },
  { id: "starbucks", domain: "starbucks.com", answer: "Starbucks", aliases: ["starbucks coffee"], category: "alimentation", difficulty: "medium", imageUrl: "/api/game/logos/starbucks/image" },
  { id: "ferrari", domain: "ferrari.com", answer: "Ferrari", aliases: ["scuderia ferrari"], category: "automobile", difficulty: "medium", imageUrl: "/api/game/logos/ferrari/image" },
];

const rooms = new Map<string, Room>();
let ioRef: Server | undefined;

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
  playersOnline: ioRef?.engine.clientsCount ?? 0,
  publicRooms: [...rooms.values()].filter((r) => r.isPublic && r.status === "waiting").length,
  gamesInProgress: [...rooms.values()].filter((r) => r.status === "playing").length,
});
export const getPublicRooms = () => [...rooms.values()].filter((r) => r.isPublic && r.status === "waiting").map(publicRoom);

function broadcastRooms() {
  ioRef?.emit("rooms:update", getPublicRooms());
  ioRef?.emit("stats:update", getStats());
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
  room.nextTimer = setTimeout(() => {
    if (room.roundIndex + 1 >= room.roundCount) {
      room.status = "results";
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

    socket.on("guess:submit", (input, callback) => {
      const room = findRoomForSocket(socket);
      const player = room?.players.find((p) => p.socketId === socket.id);
      if (!room || !player || room.status !== "playing" || player.foundAt || !room.roundStartedAt) return;
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

    socket.on("room:leave", () => socket.disconnect());
    socket.on("disconnect", () => {
      const room = findRoomForSocket(socket);
      if (!room) return broadcastRooms();
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
    });
  });
  setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [code, room] of rooms) if (room.lastActiveAt < cutoff && !room.players.some((p) => p.connected)) rooms.delete(code);
  }, 60_000).unref();
  logger.info("Logo Rush realtime game server attached");
}