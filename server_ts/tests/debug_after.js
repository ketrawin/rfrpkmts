let Ab;
try { require('ts-node/register'); } catch (e) {}
Ab = require('../src/abilities');
const atk = { status:0 };
const def = { abilityName: 'static', hp: 20 };
const res = [];
console.log('Before call');
const origRand = Math.random;
Math.random = () => 0.0;
try {
	Ab.afterMoveApply(atk, def, 'tackle', { contact: true }, res);
} finally { Math.random = origRand; }
console.log('After call results=', res, 'attacker.status=', atk.status);
