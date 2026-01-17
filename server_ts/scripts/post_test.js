const http = require('http');
const data = JSON.stringify({ username: 'testuser', password: 'password123', email: 'test@example.com' });
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

function attempt(attemptsLeft) {
  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
      console.log('[post_test] STATUS', res.statusCode);
      console.log('[post_test] BODY', body);
      process.exit(0);
    });
  });
  req.on('error', (e) => {
    if (attemptsLeft <= 0) {
      console.error('[post_test] final error', e.message);
      process.exit(2);
    }
    console.log('[post_test] error, retrying...', e.message);
    setTimeout(() => attempt(attemptsLeft - 1), 500);
  });
  req.write(data);
  req.end();
}

attempt(20);
