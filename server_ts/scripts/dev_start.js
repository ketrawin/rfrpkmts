const { spawn } = require('child_process');
const path = require('path');
const cwd = path.resolve(__dirname, '..');
const env = Object.assign({}, process.env, {
  BYPASS_CAPTCHA: 'true',
  MONGODB_URI: 'mongodb://localhost:27017/pokemmo_refactor'
});

console.log('[dev_start] starting npm run dev in', cwd);
const child = spawn('npm', ['run', 'dev'], { cwd, env, stdio: 'inherit', shell: true });

child.on('exit', (code, signal) => {
  console.log('[dev_start] child exited', code, signal);
  process.exit(code === null ? 0 : code);
});

child.on('error', (err) => {
  console.error('[dev_start] spawn error', err);
  process.exit(2);
});
const fs = require('fs');
const src = fs.readFileSync(require('path').resolve(__dirname, '..', 'dev_start.js'));
require('fs').writeFileSync('dev_start.js', src);
console.log('Placeholder: original dev_start.js moved here. Use root dev_start.js to run.');
