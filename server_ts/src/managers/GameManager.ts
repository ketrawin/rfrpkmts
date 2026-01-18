import { Socket } from 'socket.io';
import * as CharacterService from '../services/character.service';
import { sendLoadMapForUser } from '../gameLogic';
import { ClientToServerEvents, ServerToClientEvents } from '../types/socketEvents';

type AnySocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface Session {
  username: string;
  socketId: string;
  socket?: AnySocket;
  lastActive: number;
  player?: any;
}

export class GameManager {
  private sessions: Map<string, Session> = new Map();
  private tickIntervalMs: number;
  private tickHandle: NodeJS.Timeout | null = null;
  private flushHandle: NodeJS.Timeout | null = null;
  private flushIntervalMs: number = 5000;
  private dirtySessions: Set<string> = new Set();

  constructor(tickIntervalMs: number = 1000) {
    this.tickIntervalMs = tickIntervalMs;
  }

  private persistPositions: boolean = false;

  setPersistPositions(flag: boolean) {
    this.persistPositions = flag;
    if (flag) this.startFlush(); else this.stopFlush();
  }

  setFlushInterval(ms: number) {
    this.flushIntervalMs = ms;
    if (this.flushHandle) {
      this.stopFlush();
      this.startFlush();
    }
  }

  private startFlush() {
    if (this.flushHandle) return;
    this.flushHandle = setInterval(() => { void this.flushPositions(); }, this.flushIntervalMs);
  }

  private stopFlush() {
    if (this.flushHandle) { clearInterval(this.flushHandle); this.flushHandle = null; }
  }

  start() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  stop() {
    if (this.tickHandle) { clearInterval(this.tickHandle); this.tickHandle = null; }
  }

  private tick() {
    const now = Date.now();
    // update per-session tick counters
    for (const s of this.sessions.values()) {
      (s as any).tickCount = ((s as any).tickCount || 0) + 1;
      s.lastActive = now;
    }
  }

  ensureSession(username: string, socket?: AnySocket) {
    let sess = this.sessions.get(username);
    if (!sess) {
      sess = { username, socketId: socket ? socket.id : 'unknown', socket, lastActive: Date.now() };
      (sess as any).tickCount = 0;
      this.sessions.set(username, sess);
    } else {
      if (socket) { sess.socket = socket; sess.socketId = socket.id; }
      sess.lastActive = Date.now();
    }
    return sess;
  }

  getSession(username: string) {
    return this.sessions.get(username) || null;
  }

  removeSession(username: string) {
    return this.sessions.delete(username);
  }

  async createCharacterAndStart(socket: AnySocket, username: string, starter: string, character: string) {
    // create character using existing service
    await CharacterService.createCharacterForUser(username, starter, character);
    // ensure session and emit startGame
    this.ensureSession(username, socket);
    try { socket.emit('startGame', { username }); } catch (e) {}
    await sendLoadMapForUser(socket, username);
  }

  async startSession(socket: AnySocket, username: string) {
    this.ensureSession(username, socket);
    try { socket.emit('startGame', { username }); } catch (e) {}
    await sendLoadMapForUser(socket, username);
  }

  handleInput(username: string, input: { type: string; direction?: number }) {
    const sess = this.getSession(username);
    if (!sess) return;
    if (!sess.player) return;
      if (input.type === 'move' && typeof input.direction === 'number') {
      const dir = input.direction;
      switch (dir) {
        case 0: // down
          sess.player.y = (sess.player.y || 0) + 1;
          break;
        case 1: // left
          sess.player.x = (sess.player.x || 0) - 1;
          break;
        case 2: // up
          sess.player.y = (sess.player.y || 0) - 1;
          break;
        case 3: // right
          sess.player.x = (sess.player.x || 0) + 1;
          break;
        default:
          break;
      }
      // broadcast updated player to the player socket
      this.broadcastState(username);
      // mark dirty for later flush if persistence enabled
      if (this.persistPositions) this.dirtySessions.add(username);
    }
  }

  async flushPositions() {
    if (this.dirtySessions.size === 0) return;
    const toFlush = Array.from(this.dirtySessions);
    this.dirtySessions.clear();
    try {
      const CharacterService = require('../services/character.service');
      const promises = toFlush.map(u => {
        const s = this.getSession(u) as any;
        if (!s || !s.player) return Promise.resolve();
        return CharacterService.updatePosition(u, s.player.x, s.player.y, s.player.direction);
      });
      await Promise.allSettled(promises);
    } catch (e) {
      for (const u of toFlush) this.dirtySessions.add(u);
    }
  }

  async flushSession(username: string) {
    try {
      const CharacterService = require('../services/character.service');
      const s = this.getSession(username) as any;
      if (!s || !s.player) return;
      await CharacterService.updatePosition(username, s.player.x, s.player.y, s.player.direction);
      this.dirtySessions.delete(username);
    } catch (e) {
      // on error, keep session dirty for later retry
      this.dirtySessions.add(username);
    }
  }

  broadcastState(username: string) {
    const sess = this.getSession(username);
    if (!sess || !sess.socket || !sess.player) return;
    try {
      sess.socket.emit('player_update', { username, x: sess.player.x, y: sess.player.y, direction: sess.player.direction });
    } catch (e) {}
  }
}

export const gameManager = new GameManager();
