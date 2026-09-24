import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Conexão em segundo plano indisponível (tentando novamente):', err?.message || err);
    });

    socket.on('error', (err) => {
      console.warn('[Socket.IO] Erro recebido:', err);
    });
  }
  return socket;
}
