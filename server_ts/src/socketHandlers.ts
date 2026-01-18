import { Server, Socket } from 'socket.io';
import { handleNewGame, handleRegister, handleLogin, handleTokenUpdate } from './socketHandlers.logic';
import { gameManager } from './managers/GameManager';
import { NewGamePayload, TokenUpdatePayload } from './types/socketEvents';
import { RegisterPayload, LoginCredentials } from './types/auth';
import { ClientToServerEvents, ServerToClientEvents } from './types/socketEvents';

export function setupSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log('[server_ts] socket connected', socket.id);
    socket.on('newGame', (data: NewGamePayload) => { void handleNewGame(socket, data); });
    socket.on('register', (data: RegisterPayload) => { void handleRegister(socket, data); });
    socket.on('login', (data: LoginCredentials) => { void handleLogin(socket, data); });
    socket.on('tokenUpdate', (data: TokenUpdatePayload) => { void handleTokenUpdate(socket, data); });

    socket.on('disconnect', async () => {
      console.log('[server_ts] socket disconnected', socket.id);
      try {
        const username = (socket as any).data && (socket as any).data.username;
        if (username && typeof username === 'string') {
          await gameManager.flushSession(username);
        }
      } catch (e) {}
    });
  });
}
