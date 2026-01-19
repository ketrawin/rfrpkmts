import jwt from 'jsonwebtoken';
import * as AuthService from './services/auth.service';
import { validateCredentials } from './utils/validators';
import * as CharacterService from './services/character.service';
import { gameManager } from './managers/GameManager';
import { createRateLimiter } from './utils/rateLimiter';
import { sendLoadMapForUser } from './gameLogic';
import { Socket } from 'socket.io';
import { NewGamePayload, TokenUpdatePayload, ClientToServerEvents, ServerToClientEvents } from './types/socketEvents';
import { RegisterPayload, LoginCredentials } from './types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const rateWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 10;
const maxRegisterAttempts = 5;
const loginLimiter = createRateLimiter(maxLoginAttempts, rateWindowMs);
const registerLimiter = createRateLimiter(maxRegisterAttempts, rateWindowMs);

const SERVER_CONST = {
  pokemonStarters: ["1","4","7","10","13","16","25","29","32","43","60","66","69","74","92","133"],
  characterSprites: ["red","red_-135","JZJot","22jM7"]
};

export async function handleNewGame(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: NewGamePayload) {
  try {
    if ((socket as any).data && (socket as any).data.username) {
      return;
    }
    let token: string | undefined = undefined;
    try { token = (socket.handshake && (socket.handshake.auth as any) && (socket.handshake.auth as any).token) || undefined; } catch(e) {}
    if (!token) {
      try {
        const hdr = (socket.handshake && (socket.handshake.headers as any) && (socket.handshake.headers as any).authorization) || null;
        if (hdr && typeof hdr === 'string' && hdr.indexOf(' ') > 0) token = hdr.split(' ')[1];
      } catch(e) {}
    }
    if (!token) {
      socket.emit('newGame_result', { result: 'not_authenticated' });
      return;
    }
    let payload: any = null;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { payload = null; }
    if ((!payload || !payload.username) && data && typeof data.token === 'string') {
      try { payload = jwt.verify(data.token, JWT_SECRET); } catch (e) { payload = null; }
    }
    if (!payload || !payload.username) {
      socket.emit('newGame_result', { result: 'invalid_token' });
      return;
    }
    const username = payload.username as string;
    if (!data || typeof data.starter !== 'string' || typeof data.character !== 'string') { socket.emit('newGame_result', { result: 'invalid_input' }); return; }
    if (!SERVER_CONST.pokemonStarters.includes(data.starter) || !SERVER_CONST.characterSprites.includes(data.character)) { socket.emit('newGame_result', { result: 'invalid_choice' }); return; }
    await gameManager.createCharacterAndStart(socket, username, data.starter, data.character);
  } catch (err) {
    try { socket.emit('newGame_result', { result: 'internal_error' }); } catch(e) {}
  }
}

export async function handleRegister(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: RegisterPayload) {
  const { username, password, email } = data || {};
  const ip = socket.handshake.address || 'unknown';
  if (registerLimiter.isRateLimited(ip)) {
    socket.emit('registration', { result: 'rate_limited' });
    return;
  }
  if (!username || !password) { socket.emit('registration', { result: 'missing_fields' }); return; }
  if (!email) { socket.emit('registration', { result: 'missing_email' }); return; }
  const v = validateCredentials({ username, password, email });
  if (!v.ok) { socket.emit('registration', { result: 'invalid_input', errors: v.errors }); return; }
  try {
    const r = await AuthService.registerUser({ username, password, email });
    if (!r.ok) {
      socket.emit('registration', { result: r.errors ? r.errors[0] : 'register_failed' });
      return;
    }
    socket.emit('registration', { result: 'success' });
  } catch (e) {
    socket.emit('registration', { result: 'internal_error' });
  }
}

export async function handleLogin(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: LoginCredentials) {
  const { username, password } = data || {};
  if (!username || !password) { socket.emit('login_result', { result: 'missing_fields' }); return; }
  const ip = socket.handshake.address || 'unknown';
  if (loginLimiter.isRateLimited(ip)) {
    socket.emit('login_result', { result: 'rate_limited' });
    return;
  }
  try {
    const r = await AuthService.loginUser({ username, password });
    if (!r.ok) { socket.emit('login_result', { result: 'invalid_credentials' }); return; }
    const token = r.token;
    try { (socket as any).data = (socket as any).data || {}; (socket as any).data.username = r.user!.username; } catch (e) {}
    socket.emit('login_result', { result: 'success', token });
    try {
      const hasChar = await CharacterService.userHasCharacter(r.user!.username);
      console.log('[server_ts] handleLogin userHasCharacter', r.user!.username, hasChar);
      if (!hasChar) {
        socket.emit('newGame', { username: r.user!.username, starters: SERVER_CONST.pokemonStarters, characters: SERVER_CONST.characterSprites });
        const handler = async (sel: any) => {
          try {
            if (!sel || typeof sel.starter !== 'string' || typeof sel.character !== 'string') return;
            if (!SERVER_CONST.pokemonStarters.includes(sel.starter) || !SERVER_CONST.characterSprites.includes(sel.character)) return;
            await gameManager.createCharacterAndStart(socket, r.user!.username, sel.starter, sel.character);
          } catch (e) { console.warn('[server_ts] newGame handler error', e); }
        };
        socket.once('newGame', handler);
      } else {
        await gameManager.startSession(socket, r.user!.username);
        console.log('[server_ts] startSession invoked for', r.user!.username);
      }
    } catch (e) { console.warn('[server_ts] handleLogin userHasCharacter error', e); }
  } catch (e) {
    socket.emit('login_result', { result: 'internal_error' });
  }
}

export async function handleTokenUpdate(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: TokenUpdatePayload) {
  try {
    const token = data && typeof data.token === 'string' ? data.token : undefined;
    if (!token) { socket.emit('tokenUpdate_result', { result: 'missing_token' }); return; }
    let payload: any = null;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { payload = null; }
    if (!payload || !payload.username) { socket.emit('tokenUpdate_result', { result: 'invalid_token' }); return; }
    const username = payload.username as string;
    try { (socket as any).data = (socket as any).data || {}; (socket as any).data.username = username; } catch (e) {}
    socket.emit('tokenUpdate_result', { result: 'success', username });
    try {
      const hasChar = await CharacterService.userHasCharacter(username);
      console.log('[server_ts] handleTokenUpdate userHasCharacter', username, hasChar);
      if (hasChar) {
        await gameManager.startSession(socket, username);
        console.log('[server_ts] startSession invoked for', username);
      } else {
        socket.emit('newGame', { username, starters: SERVER_CONST.pokemonStarters, characters: SERVER_CONST.characterSprites });
        const handler = async (sel: any) => {
          try {
            if (!sel || typeof sel.starter !== 'string' || typeof sel.character !== 'string') return;
            if (!SERVER_CONST.pokemonStarters.includes(sel.starter) || !SERVER_CONST.characterSprites.includes(sel.character)) return;
            await gameManager.createCharacterAndStart(socket, username, sel.starter, sel.character);
          } catch (e) { console.warn('[server_ts] newGame handler error', e); }
        };
        socket.once('newGame', handler);
      }
    } catch (e) { console.warn('[server_ts] handleTokenUpdate userHasCharacter error', e); }
  } catch (err) {
    try { socket.emit('tokenUpdate_result', { result: 'internal_error' }); } catch(e) {}
  }
}
