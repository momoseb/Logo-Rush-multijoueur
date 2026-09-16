import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { attachGameServer } from "./game";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
const io = new Server(server, {
  path: "/socket.io",
  cors: { origin: true, credentials: true },
});
attachGameServer(io);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});
