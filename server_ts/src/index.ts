import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './models/User';
import * as AuthService from './services/auth.service';
import { validateCredentials } from './utils/validators';
import Character from './models/Character';
import * as CharacterService from './services/character.service';
import fs from 'fs';
import path from 'path';
import { createRateLimiter } from './utils/rateLimiter';

const app = express();
app.use(express.json());
// Simple CORS middleware for dev (allows requests from the frontend)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
 
// Health check for readiness
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: '*' } });

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 2827;
const BYPASS_CAPTCHA = process.env.BYPASS_CAPTCHA === 'true';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemmo_refactor';

// Server constants ported from legacy
const SERVER_CONST = {
  pokemonStarters: ["1","4","7","10","13","16","25","29","32","43","60","66","69","74","92","133"],
  characterSprites: ["red","red_-135","JZJot","22jM7"]
};

function createStarterPokemon(starterId: string) {
  // minimal starter representation; extend if client expects more fields
  const id = parseInt(starterId, 10) || 1;
  return {
    id,
    level: 5,
    shiny: false,
    experience: 0,
    // placeholder for other fields the client may expect
    ivs: {},
    moves: []
  };
}



function verifyCaptcha(ip: string, challenge: string | undefined, response: string | undefined): Promise<boolean> {
  if (BYPASS_CAPTCHA) {
    console.log('[server_ts] BYPASS_CAPTCHA enabled, skipping captcha check for', ip);
    return Promise.resolve(true);
  }
  if (!challenge && !response) return Promise.resolve(true);
  return Promise.resolve(true);
}

app.post('/register', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const { username, password, email, challenge, response } = req.body || {};

  if (registerLimiter.isRateLimited(ip)) {
    console.warn('[server_ts] rate limit register', ip);
    return res.status(429).json({ result: 'rate_limited' });
  }

  // do basic validation first
  const v = validateCredentials({ username, password, email });
  if (!v.ok) return res.status(400).json({ result: 'invalid_input', errors: v.errors });

  const okCaptcha = await verifyCaptcha(ip, challenge, response);
  if (!okCaptcha) return res.json({ result: 'invalid_captcha' });

  try {
    const r = await AuthService.registerUser({ username, password, email });
    if (!r.ok) return res.json({ result: r.errors ? r.errors[0] : 'register_failed' });
    return res.json({ result: 'success' });
  } catch (e) {
    console.error('[server_ts] register error', e);
    return res.json({ result: 'internal_error' });
  }
});

// JWT secret (dev default if not provided)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

if (JWT_SECRET === 'dev-secret-change-me') {
  console.warn('[server_ts] WARNING: using default JWT_SECRET from index.ts. Change JWT_SECRET for production.');
}

// Create shared in-memory rate limiters
const rateWindowMs = 15 * 60 * 1000; // 15 minutes
const maxLoginAttempts = 10; // max attempts per window
const maxRegisterAttempts = 5;
const loginLimiter = createRateLimiter(maxLoginAttempts, rateWindowMs);
const registerLimiter = createRateLimiter(maxRegisterAttempts, rateWindowMs);

// Basic validators
function isValidUsername(u?: string) {
  if (!u) return false;
  if (u.length < 4 || u.length > 32) return false;
  return /^[A-Za-z0-9_]+$/.test(u);
}
function isValidPassword(p?: string) {
  if (!p) return false;
  return p.length >= 8 && p.length <= 128;
}
function isValidEmail(email?: string) {
  if (!email) return false;
  const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  return re.test(email);
}

// Login endpoint (returns JWT)
app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ result: 'missing_fields' });

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (loginLimiter.isRateLimited(ip)) {
    console.warn('[server_ts] rate limit login', ip);
    return res.status(429).json({ result: 'rate_limited' });
  }

  try {
    const r = await AuthService.loginUser({ username, password });
    if (!r.ok) return res.json({ result: 'invalid_credentials' });
    // return token
    return res.json({ result: 'success', token: r.token });
  } catch (e) {
    console.error('[server_ts] login error', e);
    return res.json({ result: 'internal_error' });
  }
});

// Auth middleware: verifies Bearer JWT and attaches user to request
async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth) return res.status(401).json({ result: 'unauthorized' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ result: 'unauthorized' });
  const token = parts[1];
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    // legacy tokens created by auth.service include `id` and `username` fields
    if (!payload || !(payload.id || payload.userId)) return res.status(401).json({ result: 'unauthorized' });
    const userId = payload.id || payload.userId;
    // load user (without passwordHash)
    const user = await User.findById(userId).select('-passwordHash').lean().exec();
    if (!user) return res.status(401).json({ result: 'invalid_token' });
    (req as any).user = user;
    next();
  } catch (e) {
    return res.status(401).json({ result: 'invalid_token' });
  }
}

// Protected endpoint: returns current user info
app.get('/me', authMiddleware, (req, res) => {
  const user = (req as any).user;
  res.json({ result: 'success', user });
});

io.on('connection', (socket) => {
  console.log('[server_ts] socket connected', socket.id);

  // global trace for any newGame emits (helps detect client emits outside expected flow)
  socket.on('newGame', async (data) => {
    console.log('[server_ts] trace: socket.on("newGame") received', socket.id, data);
    try {
      // If a per-login handler already attached username to socket.data, skip global handling
      if ((socket as any).data && (socket as any).data.username) {
        console.log('[server_ts] newGame global handler skipping because socket.data.username exists', (socket as any).data.username);
        return;
      }

      // Try to authenticate via token in handshake auth (or Authorization header)
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
      // fallback: token may be provided in the data payload (client sent it manually)
      if ((!payload || !payload.username) && data && typeof data.token === 'string') {
        try { payload = jwt.verify(data.token, JWT_SECRET); } catch (e) { payload = null; }
      }
      if (!payload || !payload.username) {
        socket.emit('newGame_result', { result: 'invalid_token' });
        return;
      }

      const username = payload.username as string;
      // validate payload
      if (!data || typeof data.starter !== 'string' || typeof data.character !== 'string') { socket.emit('newGame_result', { result: 'invalid_input' }); return; }
      if (!SERVER_CONST.pokemonStarters.includes(data.starter) || !SERVER_CONST.characterSprites.includes(data.character)) { socket.emit('newGame_result', { result: 'invalid_choice' }); return; }

      // create character and send start/load
      await CharacterService.createCharacterForUser(username, data.starter, data.character);
      socket.emit('startGame', { username });
      await sendLoadMapForUser(socket, username);
    } catch (err) {
      console.error('[server_ts] global newGame handler error', err);
      try { socket.emit('newGame_result', { result: 'internal_error' }); } catch(e) {}
    }
  });

  socket.on('register', async (data) => {
    const { username, password, email, challenge, response } = data || {};
    const ip = socket.handshake.address || 'unknown';

    if (registerLimiter.isRateLimited(ip)) {
      console.warn('[server_ts] socket rate limit register', ip);
      socket.emit('registration', { result: 'rate_limited' });
      return;
    }

    if (!username || !password) { socket.emit('registration', { result: 'missing_fields' }); return; }
    if (!email) { socket.emit('registration', { result: 'missing_email' }); return; }

    const v = validateCredentials({ username, password, email });
    if (!v.ok) { socket.emit('registration', { result: 'invalid_input', errors: v.errors }); return; }

    const okCaptcha = await verifyCaptcha(ip, challenge, response);
    if (!okCaptcha) { socket.emit('registration', { result: 'invalid_captcha' }); return; }

    try {
      const r = await AuthService.registerUser({ username, password, email });
      if (!r.ok) {
        socket.emit('registration', { result: r.errors ? r.errors[0] : 'register_failed' });
        return;
      }
      console.log('[server_ts] Created user via socket', username);
      socket.emit('registration', { result: 'success' });
    } catch (e) {
      console.error('[server_ts] socket register error', e);
      socket.emit('registration', { result: 'internal_error' });
    }
  });

  // socket login
  socket.on('login', async (data) => {
    const { username, password } = data || {};
    console.log('[server_ts] socket login attempt', { username, socketId: socket.id });
    if (!username || !password) { socket.emit('login_result', { result: 'missing_fields' }); return; }

    const ip = socket.handshake.address || 'unknown';
    if (loginLimiter.isRateLimited(ip)) {
      console.warn('[server_ts] socket rate limit login', ip);
      socket.emit('login_result', { result: 'rate_limited' });
      return;
    }

    try {
      const r = await AuthService.loginUser({ username, password });
      if (!r.ok) { socket.emit('login_result', { result: 'invalid_credentials' }); return; }

      const token = r.token;
      try { (socket as any).data = (socket as any).data || {}; (socket as any).data.username = r.user!.username; } catch (e) {}
      socket.emit('login_result', { result: 'success', token });

      // legacy newGame flow (business logic moved to CharacterService)
      try {
        const hasChar = await CharacterService.userHasCharacter(r.user!.username);
        if (!hasChar) {
          socket.emit('newGame', { username: r.user!.username, starters: SERVER_CONST.pokemonStarters, characters: SERVER_CONST.characterSprites });
          const handler = async (sel: any) => {
            console.log('[server_ts] newGame handler invoked for', socket.id, 'selection=', sel);
            try {
              if (!sel || typeof sel.starter !== 'string' || typeof sel.character !== 'string') return;
              if (!SERVER_CONST.pokemonStarters.includes(sel.starter) || !SERVER_CONST.characterSprites.includes(sel.character)) return;
              await CharacterService.createCharacterForUser(r.user!.username, sel.starter, sel.character);
              // after creation, send start + load map
              socket.emit('startGame', { username: r.user!.username });
              await sendLoadMapForUser(socket, r.user!.username);
            } catch (e) { console.error('[server_ts] newGame handler error', e); }
          };
          socket.once('newGame', handler);
        } else {
          socket.emit('startGame', { username: r.user!.username });
          await sendLoadMapForUser(socket, r.user!.username);
        }
      } catch (e) { console.warn('[server_ts] post-login newGame check failed', e); }
    } catch (e) {
      console.error('[server_ts] socket login error', e);
      socket.emit('login_result', { result: 'internal_error' });
    }
  });

  // Non-disruptive token update: client can send a new JWT without reconnecting.
  // Server will verify and attach username to socket.data and trigger start/load flows.
  socket.on('tokenUpdate', async (data) => {
    try {
      const token = data && typeof data.token === 'string' ? data.token : undefined;
      if (!token) { socket.emit('tokenUpdate_result', { result: 'missing_token' }); return; }
      let payload: any = null;
      try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { payload = null; }
      if (!payload || !payload.username) { socket.emit('tokenUpdate_result', { result: 'invalid_token' }); return; }
      const username = payload.username as string;
      try { (socket as any).data = (socket as any).data || {}; (socket as any).data.username = username; } catch (e) {}
      socket.emit('tokenUpdate_result', { result: 'success', username });

      // After attaching, attempt to continue game flow (start/load or prompt newGame)
      try {
        const hasChar = await CharacterService.userHasCharacter(username);
        if (hasChar) {
          socket.emit('startGame', { username });
          await sendLoadMapForUser(socket, username);
        } else {
            socket.emit('newGame', { username, starters: SERVER_CONST.pokemonStarters, characters: SERVER_CONST.characterSprites });
            const handler = async (sel: any) => {
              console.log('[server_ts] newGame handler invoked for (tokenUpdate)', socket.id, 'selection=', sel);
              try {
                if (!sel || typeof sel.starter !== 'string' || typeof sel.character !== 'string') return;
                if (!SERVER_CONST.pokemonStarters.includes(sel.starter) || !SERVER_CONST.characterSprites.includes(sel.character)) return;
                await CharacterService.createCharacterForUser(username, sel.starter, sel.character);
                socket.emit('startGame', { username });
                await sendLoadMapForUser(socket, username);
              } catch (e) { console.error('[server_ts] newGame handler error (tokenUpdate)', e); }
            };
            socket.once('newGame', handler);
        }
      } catch (e) {
        console.warn('[server_ts] tokenUpdate post-auth flow failed', e);
      }
    } catch (err) {
      console.error('[server_ts] tokenUpdate handler error', err);
      try { socket.emit('tokenUpdate_result', { result: 'internal_error' }); } catch(e) {}
    }
  });

  socket.on('disconnect', () => {
    console.log('[server_ts] socket disconnected', socket.id);
  });
});

  // NOTE: tokenUpdate handler is intentionally outside of the per-socket listeners
  // to remain compatible with clients that update token without reconnecting.
  // (We add it here at module scope so it registers once for future connections.)


async function sendLoadMapForUser(socket: any, username: string) {
  try {
    const char = await CharacterService.getCharacterForUser(username);
    if (!char) return;
    const mapName = (char.map || (char.respawnLocation && char.respawnLocation.mapName) || 'pallet') as string;
    const payload = {
      mapName,
      player: {
        username,
        x: char.x,
        y: char.y,
        direction: char.direction,
        respawnLocation: char.respawnLocation,
        pokemon: char.pokemon || []
      }
    };
    socket.emit('loadMap', payload);
  } catch (err) {
    console.error('[server_ts] sendLoadMapForUser error', err);
  }
}

// Connect to MongoDB then start server
mongoose.connect(MONGODB_URI).then(() => {
  console.log('[server_ts] connected to MongoDB', MONGODB_URI);
  server.listen(PORT, () => {
    console.log(`server_ts listening on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('[server_ts] failed to connect to MongoDB', err);
  process.exit(1);
});
