// Tests for newly ported abilities: static, effectspore, poisonpoint, levitate, damp, sturdy
let BH, Abilities;
try { require('ts-node/register'); } catch (e) {}
BH = require('../src/battleHelpers').default;
Abilities = require('../src/abilities');

function makePokemon(id, level, hp, atk, def, spAtk, spDef, abilityName, maxHp) {
  return {
    id: String(id), level, hp, maxHp: maxHp || hp, atk, def, spAtk, spDef,
    battleStats: { atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0 },
    status: 0,
    abilityName: abilityName
  };
}

console.log('Running abilities_port_test...');

// Helper to force deterministic randomness
function withRandom(val, fn) {
  const orig = Math.random;
  Math.random = () => val;
  try { fn(); } finally { Math.random = orig; }
}

// Static: contact move should paralyze attacker with forced rand=0
(function testStatic(){
  const attacker = makePokemon(1,5,30,12,10,8,9,null);
  const defender = makePokemon(2,5,28,10,11,6,7,'static');
  withRandom(0.0, () => {
    const res = BH.processMove(attacker, defender, 'tackle');
    const inf = res.find(r=> r.type === 'inflictStatus');
    console.log('static inflicted?', !!inf, 'attacker.status=', attacker.status);
  });
})();

// Effect Spore: contact move should inflict one of statuses
(function testEffectSpore(){
  const attacker = makePokemon(3,5,30,12,10,8,9,null);
  const defender = makePokemon(4,5,28,10,11,6,7,'effectspore');
  withRandom(0.0, ()=>{
    const res = BH.processMove(attacker, defender, 'tackle');
    const inf = res.find(r=> r.type === 'inflictStatus');
    console.log('effectspore inflicted?', !!inf, 'status=', inf && inf.status);
  });
})();

// Poison Point
(function testPoisonPoint(){
  const attacker = makePokemon(5,5,30,12,10,8,9,null);
  const defender = makePokemon(6,5,28,10,11,6,7,'poisonpoint');
  withRandom(0.0, ()=>{
    const res = BH.processMove(attacker, defender, 'tackle');
    const inf = res.find(r=> r.type === 'inflictStatus');
    console.log('poisonpoint inflicted?', !!inf, 'status=', inf && inf.status);
  });
})();

// Levitate blocks ground move
(function testLevitate(){
  const attacker = makePokemon(7,5,30,12,10,8,9,null);
  const defender = makePokemon(8,5,28,10,11,6,7,'levitate');
  const moveData = { moveType: 'simple', type: 'ground', contact: false, power: 80 };
  const pre = Abilities.beforeMoveApply(attacker, defender, 'earthquake', moveData);
  console.log('levitate blocks ground?', !!pre && pre.blocked, 'reason=', pre && pre.reason);
})();

// Damp blocks explosion
(function testDamp(){
  const attacker = makePokemon(9,5,30,12,10,8,9,null);
  const defender = makePokemon(10,5,28,10,11,6,7,'damp');
  const pre = Abilities.beforeMoveApply(attacker, defender, 'selfdestruct', { moveType: 'simple' });
  console.log('damp blocks selfdestruct?', !!pre && pre.blocked, 'reason=', pre && pre.reason);
})();

// Sturdy prevents OHKO
(function testSturdy(){
  const attacker = makePokemon(11,5,100,120,10,8,9,null);
  const defender = makePokemon(12,5,50,10,11,6,7,'sturdy', 50);
  // Make a powerful move by patching moves.json entry for a moment
  const res = BH.processMove(attacker, defender, 'explosion');
  // If sturdy worked, defender.hp should be 1
  console.log('sturdy result hp:', defender.hp, 'results contain sturdyActivated?', res.some(r=>r.type==='sturdyActivated'));
})();

console.log('abilities_port_test done.');
process.exit(0);
