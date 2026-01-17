// Tests: afterMoveApply invocation and deterministic calculateDamage
let BH, Abilities;
try { require('ts-node/register'); } catch (e) {}
BH = require('../src/battleHelpers').default;
Abilities = require('../src/abilities');

function makePokemon(id, level, hp, atk, def, spAtk, spDef, abilityName) {
  return {
    id: String(id), level, hp, atk, def, spAtk, spDef,
    battleStats: { atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0 },
    status: 0,
    abilityName: abilityName
  };
}

console.log('Running more_tests...');

// Test 1: afterMoveApply hook is invoked and can modify results
(function testAfterHook() {
  const attacker = makePokemon(1,5,30,12,10,8,9,null);
  const defender = makePokemon(2,5,28,10,11,6,7,null);

  // patch afterMoveApply to push marker
  const origAfter = Abilities.afterMoveApply;
  Abilities.afterMoveApply = function(att, def, moveName, moveData, results) {
    results.push({ type: 'AFTER_HOOK_CALLED' });
  };

  const res = BH.processMove(attacker, defender, 'tackle');
  const found = res.find(r => r && r.type === 'AFTER_HOOK_CALLED');
  console.log('afterHook called?', !!found);

  // restore
  Abilities.afterMoveApply = origAfter;
})();

// Test 2: deterministic calculateDamage via stubbing Math.random
(function testCalculateDamageDeterministic() {
  const p1 = makePokemon(1,10,40,30,20,25,18,null);
  const p2 = makePokemon(4,10,38,28,22,20,19,null);
  const moveData = { power: 50, type: 'normal' };

  const origRandom = Math.random;
  try {
    // force random to 0 -> maximize chance for critical/random modifiers
    Math.random = () => 0.0;
    const r1 = BH.calculateDamage(p1, p2, moveData);

    // force random to 0.99 -> minimal modifier, non-critical
    Math.random = () => 0.99;
    const r2 = BH.calculateDamage(p1, p2, moveData);

    console.log('calcDamage with rand=0 =>', r1);
    console.log('calcDamage with rand=0.99 =>', r2);
  } finally {
    Math.random = origRandom;
  }
})();

console.log('more_tests done.');
process.exit(0);
