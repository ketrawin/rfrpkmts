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

// Test 1: soundproof should block sound moves (we'll simulate a "sing"-like move)
(async () => {
  const attacker = makePokemon(1,5,20,12,10,8,9,null);
  const defender = makePokemon(2,5,18,10,11,6,7,'soundproof');

  // create a fake move that applies sleep (applyStatus: 2)
  const moveName = 'sing-test-move';
  const moveData = { moveType: 'applyStatus', applyStatus: 1, accuracy: 1.0, type: 'normal', isSound: true };

  // call ability beforeMoveApply directly
  const pre = Abilities.beforeMoveApply(attacker, defender, moveName, moveData);
  console.log('beforeMoveApply result:', pre);

  // If blocked, simulate processMove behavior
  let results;
  if (pre && pre.blocked) {
    results = [{ type: 'moveBlockedByAbility', reason: pre.reason }];
  } else {
    // fallback to processMove using a move present in moves.json (tackle)
    results = BH.processMove(attacker, defender, 'tackle');
  }

  console.log('process results:', results);

  // Test 2: insomnia should block sleep status
  const defender2 = makePokemon(3,5,18,10,11,6,7,'insomnia');
  const pre2 = Abilities.beforeMoveApply(attacker, defender2, moveName, moveData);
  console.log('insomnia beforeMoveApply:', pre2);

  // Print summary
  console.log('Done tests.');
  process.exit(0);
})();
