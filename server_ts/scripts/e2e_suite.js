const fetch = require('node-fetch');
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const SERVER = process.env.SERVER || 'http://localhost:2827';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

(async function(){
  try {
    const uname = 'e2e_user_' + Date.now();
    const pass = 'password123';
    const email = uname + '@example.test';
    console.log('[e2e] registering', uname);
    let resp = await fetch(SERVER + '/register', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ username: uname, password: pass, email }) });
    const jr = await resp.json();
    console.log('[e2e] register result', jr);

    console.log('[e2e] logging in via REST');
    resp = await fetch(SERVER + '/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ username: uname, password: pass }) });
    const j = await resp.json();
    console.log('[e2e] login result', j);
    if (!j || j.result !== 'success' || !j.token) { console.error('[e2e] rest login failed'); process.exit(2); }
    const token = j.token;

    // connect socket with token
    console.log('[e2e] connecting socket with token');
    const socket = io(SERVER, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.on('connect', () => console.log('[e2e] socket connected', socket.id));
    socket.on('connect', () => { try { socket.emit('tokenUpdate', { token }); console.log('[e2e] emitted tokenUpdate'); } catch(e) { console.warn('tokenUpdate emit failed', e); } });
    socket.on('disconnect', (r) => console.log('[e2e] socket disconnected', r));
    socket.onAny((e, ...args) => { console.log('[e2e] event', e, args && args.length ? args[0] : ''); });

    let gotNewGame = false;
    let gotLoad = false;

    socket.on('newGame', (data) => {
      console.log('[e2e] server emitted newGame', data);
      gotNewGame = true;
      // choose first starter and first character
      const starter = (data && data.starters && data.starters[0]) || '1';
      const character = (data && data.characters && data.characters[0]) || 'red';
      console.log('[e2e] selecting starter', starter, character);
      socket.emit('newGame', { starter, character });
    });

    socket.on('startGame', (d) => {
      console.log('[e2e] startGame received', d);
      try { socket.emit('startGame_ack', {}); } catch(e) {}
    });

    socket.on('loadMap', (data) => {
      console.log('[e2e] loadMap received', data && data.mapName);
      gotLoad = true;
      // attempt a generic warp usage to test server handling (may be unsupported)
      try {
        console.log('[e2e] emitting useWarp test');
        socket.emit('useWarp', { name: 'test_warp', direction: 0 });
      } catch(e) { console.warn('useWarp emit failed', e); }

      setTimeout(() => {
        console.log('[e2e] test suite finished (map loaded)');
        socket.close();
        process.exit(0);
      }, 800);
    });

    setTimeout(() => {
      if (!gotLoad) {
        console.error('[e2e] TIMEOUT, no loadMap received');
        process.exit(3);
      }
    }, 10000);

  } catch (e) {
    console.error('E2E suite error', e);
    process.exit(5);
  }
})();
