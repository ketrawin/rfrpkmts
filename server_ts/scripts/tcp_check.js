const net = require('net');
const host = '127.0.0.1';
const port = 2827;
const s = net.createConnection({ host, port }, () => {
  console.log('[tcp_check] connected');
  s.end();
  process.exit(0);
});
s.on('error', (e) => { console.error('[tcp_check] error', e); process.exit(2); });
