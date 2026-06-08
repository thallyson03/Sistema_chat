import { io, Socket } from 'socket.io-client';
import { getPublicApiOrigin } from '../config/publicUrl';

export function createAuthenticatedSocket(): Socket {
  return io(getPublicApiOrigin(), {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
}
