const http = require('http');
const data = JSON.stringify({ username: 'testuser_once', password: 'password123', email: 'test_once@example.com' });
const options = {
  hostname: 'localhost',
  port: 2827,
  path: '/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  console.log('[run_once_post] statusCode', res.statusCode);
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log('[run_once_post] body', body);
    process.exit(0);
  });
});
req.on('error', (e) => {
  console.error('[run_once_post] error', e);
  process.exit(2);
});
req.write(data);
req.end();
