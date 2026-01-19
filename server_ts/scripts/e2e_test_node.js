const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Config
const SERVER = process.env.SERVER || 'http://localhost:2827';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const USERNAME = process.env.TEST_USER || 'ketra';

// create token
const token = jwt.sign({ username: USERNAME }, JWT_SECRET);
console.log('[e2e] token created for', USERNAME);

const socket = io(SERVER, { auth: { token }, transports: ['websocket'], reconnection: false });
let gotStart = false;
let gotLoad = false;

socket.on('connect', () => {
  console.log('[e2e] connected', socket.id);
  try { socket.emit('tokenUpdate', { token }); console.log('[e2e] emitted tokenUpdate'); } catch(e) { console.warn('[e2e] tokenUpdate emit failed', e); }
});

socket.on('disconnect', (reason) => {
  console.log('[e2e] disconnected', reason);
});

socket.onAny((e, ...args) => {
  console.log('[e2e] recv', e, args && args.length ? args[0] : '');
});

socket.on('startGame', (data) => {
  console.log('[e2e] startGame received', data);
  gotStart = true;
  try { socket.emit('startGame_ack', {}); console.log('[e2e] emitted startGame_ack'); } catch (e) { console.warn('[e2e] emit ack failed', e); }
});

socket.on('loadMap', (data) => {
  console.log('[e2e] loadMap received', data && data.mapName);
  gotLoad = true;
  // success
  console.log('[e2e] TEST OK');
  process.exit(0);
});

setTimeout(() => {
  console.error('[e2e] TIMEOUT: no loadMap received');
  process.exit(2);
}, 8000);
