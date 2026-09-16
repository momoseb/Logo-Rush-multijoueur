import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(undefined, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
    });
  }
  return socket;
};
