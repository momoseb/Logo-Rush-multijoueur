import type { Server, Socket } from "socket.io";
import { logger } from "./lib/logger";

export type Logo = {
  id: string;
  answer: string;
  aliases: string[];
  category: string;
  difficulty: "easy" | "medium" | "hard";
  imageUrl: string;
  colors: string[];
  glyph: string;
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

const mark = (label: string, foreground: string, background: string, shape: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${background}"/><path d="${shape}" fill="${foreground}"/><text x="256" y="440" text-anchor="middle" fill="${foreground}" font-family="Arial" font-size="42" font-weight="700" letter-spacing="8">${label}</text></svg>`)}`;

export const logos: Logo[] = [
  { id: "orbit", answer: "Orbit", aliases: ["orbit labs"], category: "technologie", difficulty: "easy", colors: ["#8b5cf6", "#0f0b2b"], glyph: "O", imageUrl: mark("ORBIT", "#a78bfa", "#120a33", "M256 75a181 181 0 1 0 0 362 181 181 0 0 0 0-362Zm0 72a109 109 0 1 1 0 218 109 109 0 0 1 0-218Z") },
  { id: "volt", answer: "Volt", aliases: ["volt energy"], category: "automobile", difficulty: "easy", colors: ["#d9ff45", "#142116"], glyph: "V", imageUrl: mark("VOLT", "#d9ff45", "#102015", "M290 55 130 283h99l-8 145 161-240h-99l7-133Z") },
  { id: "nova", answer: "Nova", aliases: ["nova studio"], category: "cinéma", difficulty: "medium", colors: ["#ff5c7a", "#2b0913"], glyph: "N", imageUrl: mark("NOVA", "#ff6681", "#2b0913", "M256 47 300 191 451 191 329 279 376 423 256 334 136 423 183 279 61 191 212 191Z") },
  { id: "wave", answer: "Wave", aliases: ["wave social"], category: "réseaux sociaux", difficulty: "medium", colors: ["#36d6ff", "#071d2b"], glyph: "W", imageUrl: mark("WAVE", "#39d7ff", "#071d2b", "M62 285c70-112 132-112 194 0 62 112 124 112 194 0v90c-70 89-132 89-194 0-62-89-124-89-194 0v-90Z") },
  { id: "ember", answer: "Ember", aliases: ["ember food"], category: "alimentation", difficulty: "hard", colors: ["#ff8a3d", "#2b1107"], glyph: "E", imageUrl: mark("EMBER", "#ff8a3d", "#2b1107", "M266 54c29 90-55 107-28 181 17 47 74 49 86 0 65 69 74 139 28 187-51 54-146 53-196-3-66-74-5-169 110-208-18 89 75 100 0 181 47-18 79-57 81-92Z") },
  { id: "apex", answer: "Apex", aliases: ["apex sport"], category: "sport", difficulty: "easy", colors: ["#ffffff", "#161820"], glyph: "A", imageUrl: mark("APEX", "#fff", "#151821", "M256 68 447 392h-96l-39-68H198l-38 68H65L256 68Zm0 116-29 61h59l-30-61Z") },
  { id: "pixel", answer: "Pixel", aliases: ["pixel play"], category: "jeux vidéo", difficulty: "hard", colors: ["#5cf2a5", "#08251a"], glyph: "P", imageUrl: mark("PIXEL", "#5cf2a5", "#08251a", "M94 101h108v108H94V101Zm108 108h108v108H202V209Zm108-108h108v108H310V101ZM94 317h108v108H94V317Zm216 0h108v108H310V317Z") },
  { id: "lune", answer: "Lune", aliases: ["maison lune"], category: "luxe", difficulty: "medium", colors: ["#f5d99b", "#251d19"], glyph: "L", imageUrl: mark("LUNE", "#f5d99b", "#211916", "M337 70c-91 23-137 126-88 207 34 55 98 82 159 65-38 70-128 103-207 67-94-42-130-155-78-244 43-74 134-112 214-95Z") },
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
    logo: { id: logo.id, imageUrl: logo.imageUrl, colors: logo.colors, glyph: logo.glyph, category: logo.category, difficulty: logo.difficulty },
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