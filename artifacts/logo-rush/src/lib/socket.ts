import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Same-origin (undefined) unless the API is deployed on a different
    // origin (e.g. Vercel frontend + Render backend) — see main.tsx.
    socket = io(import.meta.env.VITE_API_BASE_URL || undefined, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
    });
  }
  return socket;
};
