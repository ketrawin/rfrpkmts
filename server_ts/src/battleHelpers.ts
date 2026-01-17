import path from 'path';
import fs from 'fs';

import * as Abilities from './abilities';
import type { ICombatant } from './types/abilities';
import type { IMove } from './types/pokemon';
function loadJsonStripComments(filename: string) {
  const p = path.join(__dirname, '../../server/data', filename);
  let txt = fs.readFileSync(p, 'utf8');
  txt = txt.replace(/\/\/[^\n\r]*/g, '');
  return JSON.parse(txt);
}

const pokemonData: Record<string, any> = loadJsonStripComments('pokemon.json');
const movesData: Record<string, any> = loadJsonStripComments('moves.json');

const powerMultipler: Record<string, number> = {"-6": 2/8, "-5": 2/7, "-4": 2/6, "-3": 2/5, "-2": 2/4, "-1": 2/3, "0": 1, "1": 1.5, "2": 2, "3": 2.5, "4": 3, "5": 3.5, "6": 4 };
const criticalChance = [0, 0.065, 0.125, 0.25, 0.333, 0.5];

export function calculateDamage(pokemon: ICombatant, enemyPokemon: ICombatant, moveData: IMove | any): { damage: number; isCritical: boolean; effect: number } {
  const isMoveSpecial = !!moveData.special;
  const _p: any = pokemon as any;
  const _e: any = enemyPokemon as any;
  let attackerAtk: number;
  let defenderDef: number;
  if (isMoveSpecial) {
    attackerAtk = _p.spAtk * (powerMultipler[(_p.battleStats && _p.battleStats.spAtkPower) || 0] || 1);
    defenderDef = _e.spDef * (powerMultipler[(_e.battleStats && _e.battleStats.spDefPower) || 0] || 1);
  } else {
    attackerAtk = _p.atk * (powerMultipler[(_p.battleStats && _p.battleStats.atkPower) || 0] || 1);
    defenderDef = _e.def * (powerMultipler[(_e.battleStats && _e.battleStats.defPower) || 0] || 1);
  }
  if (_p.status === 5) attackerAtk /= 2;
  const damageBase = (2 * _p.level + 10) / 250 * (attackerAtk / defenderDef) * (moveData.power || 0) + 2;
  let modifier = 1.0;
  const pkmnData = pokemonData[_p.id] || {};
  if (moveData.type && (moveData.type === pkmnData.type1 || moveData.type === pkmnData.type2)) {
    // STAB multiplier: Adaptability doubles STAB instead of 1.5
    try {
      const atkAbility = (pokemon && pokemon.getAbilityName && typeof pokemon.getAbilityName === 'function') ? pokemon.getAbilityName() : (pokemon && pokemon.abilityName) || '';
      if (atkAbility === 'adaptability') modifier *= 2.0; else modifier *= 1.5;
    } catch (e) { modifier *= 1.5; }
  }
  // Flash Fire: if this pokemon has been activated by Flash Fire, boost its Fire moves
  try {
    if (pokemon && pokemon.flashFireActive && (pokemon.getAbilityName && pokemon.getAbilityName() === 'flashfire' || pokemon.abilityName === 'flashfire') && moveData && moveData.type === 'fire') {
      modifier *= 1.5;
    }
  } catch (e) {}
  let typeEffectiveness = 1.0;
  const getTypeEffectiveness = (t: string, other: string) => {
    if (!t || !other) return 1.0;
    const types = loadJsonStripComments('types.json');
    if (!types[t] || types[t][other] == null) return 1.0;
    return types[t][other];
  };
  typeEffectiveness *= getTypeEffectiveness(moveData.type, pokemonData[_e.id] && pokemonData[_e.id].type1);
  typeEffectiveness *= getTypeEffectiveness(moveData.type, pokemonData[_e.id] && pokemonData[_e.id].type2);
  modifier *= typeEffectiveness;
  try {
    const defAbility = (enemyPokemon && enemyPokemon.getAbilityName && typeof enemyPokemon.getAbilityName === 'function') ? enemyPokemon.getAbilityName() : (enemyPokemon && enemyPokemon.abilityName) || '';
    if ((defAbility === 'filter' || defAbility === 'filtering') && typeEffectiveness > 1) {
      modifier *= 0.75;
    }
  } catch (e) {}
  let criticalStage = 1;
  if (moveData.highCritical) criticalStage += 2;
  if (criticalStage > 5) criticalStage = 5;
  let isCritical = Math.random() < criticalChance[criticalStage];
  // Prevent critical hits if defender has Shell Armor / Battle Armor
  try {
    const defAbility = (enemyPokemon && enemyPokemon.getAbilityName && typeof enemyPokemon.getAbilityName === 'function') ? enemyPokemon.getAbilityName() : (enemyPokemon && enemyPokemon.abilityName) || '';
    if (defAbility === 'shellarmor' || defAbility === 'shell-armor' || defAbility === 'battlearmor' || defAbility === 'battle-armor') {
      isCritical = false;
    }
  } catch (e) {}
  if (isCritical) modifier *= 2;
  modifier *= 1.0 - Math.random() * 0.15;
  return { damage: Math.ceil(damageBase * modifier), isCritical, effect: typeEffectiveness };
}

// Process a move and return an array of action results describing what happened.
export function processMove(playerPokemon: ICombatant, enemyPokemon: ICombatant, moveName: string, isReflected: boolean = false): any[] {
  const _p: any = playerPokemon as any;
  const _e: any = enemyPokemon as any;
  const moveKey = (moveName || '').toLowerCase();
  let moveData = movesData[moveKey];
  if (!moveData) {
    // fallback to tackle
    moveData = movesData['tackle'] || { moveType: 'simple', power: 40, accuracy: 1.0 };
  }

  const results: any[] = [];

  if (moveData.moveType === 'buff') moveData = movesData['tackle'];

  // ability pre-check: some abilities can block moves or status
  try {
    const abRes = Abilities.beforeMoveApply(playerPokemon, enemyPokemon, moveName, moveData);
    if (abRes && abRes.blocked) {
      // handle reflection (magic-bounce) by executing the move back on the attacker
      if (abRes.reflect && !isReflected) {
        try {
          const reflected: any[] = processMove(enemyPokemon, playerPokemon, moveName, true);
          return [{ type: 'moveReflected', reason: abRes.reason }, ...reflected];
        } catch (e) {
          return [{ type: 'moveBlockedByAbility', reason: abRes.reason }];
        }
      }
      return [{ type: 'moveBlockedByAbility', reason: abRes.reason }];
    }
  } catch (e) { /* ignore ability hook errors */ }
  if (moveData.accuracy != null && moveData.accuracy !== -1) {
    // simple accuracy check (no full multipliers implemented yet)
    if (Math.random() >= (moveData.accuracy || 1.0)) {
      results.push({ type: 'moveMiss', move: moveName });
      return results;
    }
  }

  switch (moveData.moveType) {
    case 'simple': {
      const obj = calculateDamage(playerPokemon, enemyPokemon, moveData);
      _e.hp -= obj.damage;
      if (_e.hp < 0) _e.hp = 0;
      results.push({ type: 'moveAttack', move: moveName, resultHp: _e.hp, isCritical: obj.isCritical, effect: obj.effect });
      if (_e.hp > 0) {
        if (moveData.applyStatus != null) {
          if (Math.random() < (moveData.applyStatusChance == null ? 1.0 : moveData.applyStatusChance)) {
            // ability may prevent status post-check
            const abRes2 = Abilities.beforeMoveApply(playerPokemon, enemyPokemon, moveName, moveData);
            if (!(abRes2 && abRes2.blocked)) {
              _e.status = moveData.applyStatus;
              results.push({ type: 'applyStatus', status: moveData.applyStatus });
            } else {
              results.push({ type: 'statusBlockedByAbility', reason: abRes2.reason });
            }
          }
        }
        if (moveData.debuffStat != null) {
          if (Math.random() < (moveData.debuffChance == null ? 1.0 : moveData.debuffChance)) {
            const stats = (moveData.debuffStat || '').split(',');
            for (const s of stats) {
              // apply negative buff (this is a placeholder; real implementation should call Pokemon.buffBattleStat)
              if (!_e.battleStats) _e.battleStats = { learnableMoves: [], atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0,accuracy:0,evasion:0 };
              // map stat name to field
              const map: any = { atk: 'atkPower', def: 'defPower', spAtk: 'spAtkPower', spDef: 'spDefPower', speed: 'speedPower' };
              const field = map[s] || null;
              if (field) _e.battleStats[field] = (_e.battleStats as any)[field] - (moveData.debuffAmount || 1);
              results.push({ type: 'debuff', stat: s });
            }
          }
        }
      }
      break;
    }
    case 'applyStatus': {
      _e.status = moveData.applyStatus;
      results.push({ type: 'moveAttack', move: moveName, resultHp: _e.hp, isCritical: false, effect: 1 });
      results.push({ type: 'applyStatus', status: moveData.applyStatus });
      break;
    }
    case 'debuff': {
      results.push({ type: 'moveDebuff', stat: moveData.debuffStat, move: moveName });
      break;
    }
    default: {
      results.push({ type: 'moveAttack', move: moveName, resultHp: _e.hp, isCritical: false, effect: 1 });
      break;
    }
  }

  try { Abilities.afterMoveApply(playerPokemon, enemyPokemon, moveName, moveData, results); } catch (e) {}
  return results;
}

export default { calculateDamage, processMove };
