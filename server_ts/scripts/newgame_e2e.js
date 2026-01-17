const io = require('socket.io-client');
const fetch = require('node-fetch');
const mongoose = require('mongoose');

(async ()=>{
  const api = 'http://127.0.0.1:2827';
  // register a test user
  const u = 'e2e_newgame_' + Math.floor(Math.random()*10000);
  const pw = 'password123';
  try {
    const r = await fetch(api + '/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u, password: pw, email: u + '@example.com' })});
    const json = await r.json().catch(()=>({}));
    console.log('register_result', json);
    if (!json || json.result !== 'success') {
      console.error('register did not succeed, aborting', json);
      process.exit(1);
    }
    // small delay to ensure DB commit visible to socket handlers
    await new Promise((res)=>setTimeout(res, 150));
  } catch(e){ console.error('register failed', e); process.exit(1); }

  // login via socket
  const socket = io(api, { transports: ['websocket'] });
  socket.on('connect', ()=>{
    socket.emit('login', { username: u, password: pw });
  });

  socket.on('newGame', async (data)=>{
    console.log('received newGame', data);
    // pick first starter/char
    socket.emit('newGame', { starter: data.starters[0], character: data.characters[0] });
  });

  socket.on('startGame', async (data)=>{
    console.log('startGame', data);
    // verify in Mongo
    try{
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemmo_refactor');
      const coll = mongoose.connection.db.collection('characters');
      const found = await coll.findOne({ username: u });
      console.log('character saved?', !!found);
      process.exit(found ? 0 : 2);
    }catch(e){ console.error('verify error', e); process.exit(1); }
  });

  socket.on('login_result', (r)=>{ console.log('login_result', r); });
  socket.on('connect_error', (e)=>{ console.error('connect_error', e); process.exit(1); });
})();
