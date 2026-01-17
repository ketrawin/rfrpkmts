import path from 'path';
import fs from 'fs';

function loadJsonStripComments(filename: string) {
  const p = path.join(__dirname, '../../server/data', filename);
  let txt = fs.readFileSync(p, 'utf8');
  txt = txt.replace(/\/\/[^\n\r]*/g, '');
  return JSON.parse(txt);
}

const movesData = loadJsonStripComments('moves.json');
const pokemonData = loadJsonStripComments('pokemon.json');
const typesData = loadJsonStripComments('types.json');

import type { AbilityHookResult, ICombatant } from './types/abilities';
import type { IMove } from './types/pokemon';

// Simple ability hooks. These are intentionally conservative and data-driven
// so they can be expanded progressively to match legacy behavior.
export function beforeMoveApply(attacker: ICombatant | null, defender: ICombatant | null, moveName: string, moveData: IMove | any): AbilityHookResult {
  const m = (moveName || '').toLowerCase();
  const ability = (defender && defender.getAbilityName && typeof defender.getAbilityName === 'function') ? defender.getAbilityName() : (defender && defender.abilityName) || '';
  const attackerAbility = (attacker && attacker.getAbilityName && typeof attacker.getAbilityName === 'function') ? attacker.getAbilityName() : (attacker && attacker.abilityName) || '';

  // Mold Breaker: mark the move so defender abilities that would block it are ignored
  try {
    if (attackerAbility === 'moldbreaker' || attackerAbility === 'mold-breaker') {
      if (moveData) (moveData as any)._moldbreaker = true;
    }
  } catch (e) {}


  // Insomnia / Vital Spirit prevent sleep infliction
  if (moveData && moveData.applyStatus === 1) {
    if (ability === 'insomnia' || ability === 'vitalspirit') return { blocked: true, reason: 'ability prevents sleep' };
  }

  // Group 1: status/flinch immunities
  // Limber: prevent paralysis
  if (ability === 'limber') {
    if (moveData && moveData.applyStatus === 3) return { blocked: true, reason: 'limber' };
  }

  // Immunity: prevent poisoning
  if (ability === 'immunity') {
    if (moveData && moveData.applyStatus === 4) return { blocked: true, reason: 'immunity' };
  }

  // Own Tempo: prevent confusion from moves that set confusionChance
  if (ability === 'owntempo' || ability === 'own-tempo') {
    if (moveData && moveData.confusionChance && moveData.confusionChance > 0) return { blocked: true, reason: 'own-tempo' };
  }

  // Inner Focus: prevent flinch secondary effects (neutralize flinchChance)
  if (ability === 'innerfocus' || ability === 'inner-focus') {
    try {
      if (moveData && moveData.flinchChance) moveData.flinchChance = 0;
    } catch (e) {}
  }

  // Soundproof: naive list of common sound/status moves to block
  if (ability === 'soundproof') {
    const soundKeywords = ['sing','growl','hyper voice','echoed voice','chatter'];
    const moveLower = m;
    for (const k of soundKeywords) if (moveLower.indexOf(k) !== -1) return { blocked: true, reason: 'soundproof' };
  }

  // Levitate: immune to ground-type damaging moves (skip if moldbreaker)
  if (ability === 'levitate' && !(moveData && (moveData as any)._moldbreaker)) {
    if (moveData && moveData.type === 'ground' && (moveData.moveType === 'simple' || (moveData.power && moveData.power > 0))) {
      return { blocked: true, reason: 'levitate' };
    }
  }

  // Magnet Pull / Arena Trap: prevent forced switch keywords (conservative)
  if (ability === 'magnetpull' || ability === 'magnet-pull' || ability === 'magnet_pull' || ability === 'arenatrap' || ability === 'arena-trap' || ability === 'arena_trap') {
    const forcedKeywords = ['roar','whirlwind','dragontail','circlethrow','roar'];
    for (const k of forcedKeywords) if (m.indexOf(k) !== -1) return { blocked: true, reason: ability };
  }

  // Overgrow / Blaze / Torrent: boost power of matching-type moves when low HP
  try {
    if (attacker && attackerAbility) {
      const boostMap: any = { overgrow: 'grass', blaze: 'fire', torrent: 'water' };
      const neededType = boostMap[attackerAbility];
      if (neededType && moveData && moveData.type === neededType && moveData.power && moveData.power > 0) {
        const hp = typeof attacker.hp === 'number' ? attacker.hp : (attacker.currentHp || 0);
        const maxHp = typeof attacker.maxHp === 'number' ? attacker.maxHp : (attacker.maxHp || 0);
        if (maxHp > 0 && hp <= Math.floor(maxHp / 3)) {
          try { moveData.power = Math.ceil(moveData.power * 1.5); } catch (e) {}
        }
      }
    }
  } catch (e) {}

  // Clear Body: prevent stat-lowering debuffs
  if (ability === 'clearbody' || ability === 'clear-body') {
    if (moveData && moveData.debuffStat) {
      return { blocked: true, reason: 'clear-body' };
    }
  }

  // Hyper Cutter: prevent attack-lowering debuffs
  if (ability === 'hypercutter' || ability === 'hyper-cutter') {
    if (moveData && moveData.debuffStat === 'attack') {
      return { blocked: true, reason: 'hypercutter' };
    }
  }

  // Damp: prevents self-destruct/explosion style moves (skip if moldbreaker)
  if (ability === 'damp' && !(moveData && (moveData as any)._moldbreaker)) {
    if (m.indexOf('selfdestruct') !== -1 || m.indexOf('explod') !== -1 || m.indexOf('mindblown') !== -1) {
      return { blocked: true, reason: 'damp' };
    }
  }
  // Sticky Hold: prevent item-stealing moves (conservative: block known keywords)
  if (ability === 'stickyhold' || ability === 'sticky-hold' || ability === 'sticky_hold') {
    const stealKeywords = ['knock','thief','steal','pluck'];
    for (const k of stealKeywords) if (m.indexOf(k) !== -1) return { blocked: true, reason: 'sticky-hold' };
  }
  // Shield Dust: prevent secondary effects from hitting this defender
  if (ability === 'shielddust') {
    try {
      if (moveData && moveData.secondary) {
        moveData.secondary = false;
      }
      if (moveData && (moveData.chance || moveData.chance === 0)) moveData.chance = 0;
    } catch (e) {}
  }
  // Flash Fire: immune to fire moves and gains activation flag
  if (ability === 'flashfire' || ability === 'flash-fire') {
    if (moveData && moveData.type === 'fire') {
      try { if (defender) (defender as any).flashFireActive = true; } catch (e) {}
      return { blocked: true, reason: 'flashfire', activate: true };
    }
  }

  // Water Absorb: immune to water moves and heal a fraction of max HP
  if (ability === 'waterabsorb' || ability === 'water-absorb' || ability === 'water_absorb') {
    if (!(moveData && (moveData as any)._moldbreaker) && moveData && moveData.type === 'water' && (moveData.moveType === 'simple' || (moveData.power && moveData.power > 0))) {
      try {
        if (defender && typeof defender.maxHp === 'number') {
          const heal = Math.max(1, Math.floor((defender.maxHp || 1) / 4));
          defender.hp = Math.min(defender.maxHp, (defender.hp || 0) + heal);
        }
      } catch (e) {}
      return { blocked: true, reason: 'water-absorb', activate: true };
    }
  }

  // Volt Absorb / Voltabsorb: similar to Water Absorb for electric moves
  if (ability === 'voltabsorb' || ability === 'volt-absorb' || ability === 'volt_absorb' || ability === 'voltabsorb') {
    if (!(moveData && (moveData as any)._moldbreaker) && moveData && moveData.type === 'electric' && (moveData.moveType === 'simple' || (moveData.power && moveData.power > 0))) {
      try {
        if (defender && typeof defender.maxHp === 'number') {
          const heal = Math.max(1, Math.floor((defender.maxHp || 1) / 4));
          defender.hp = Math.min(defender.maxHp, (defender.hp || 0) + heal);
        }
      } catch (e) {}
      return { blocked: true, reason: 'volt-absorb', activate: true };
    }
  }

  // Dry Skin: heal from water moves, weak to fire (conservative)
  if (ability === 'dryskin' || ability === 'dry-skin' || ability === 'dry_skin') {
    if (!(moveData && (moveData as any)._moldbreaker) && moveData && moveData.type === 'water' && (moveData.moveType === 'simple' || (moveData.power && moveData.power > 0))) {
      try {
        if (defender && typeof defender.maxHp === 'number') {
          const heal = Math.max(1, Math.floor((defender.maxHp || 1) / 4));
          defender.hp = Math.min(defender.maxHp, (defender.hp || 0) + heal);
        }
      } catch (e) {}
      return { blocked: true, reason: 'dry-skin', activate: true };
    }
    // fire moves hit harder for Dry Skin (best-effort)
    if (!(moveData && (moveData as any)._moldbreaker) && moveData && moveData.type === 'fire' && moveData.power) {
      try { moveData.power = Math.ceil((moveData.power || 0) * 1.25); } catch (e) {}
    }
  }

  // Compound Eyes: increase accuracy of moves used by this attacker
  try {
    if (attacker && attackerAbility === 'compoundeyes') {
      if (moveData && typeof moveData.accuracy === 'number' && moveData.accuracy > 0) {
        moveData.accuracy = Math.min(100, Math.round(moveData.accuracy * 1.3));
      }
    }
  } catch (e) {}

  // Illuminate: modest accuracy boost for attacker
  try {
    if (attacker && attackerAbility === 'illuminate') {
      if (moveData && typeof moveData.accuracy === 'number') {
        if (moveData.accuracy <= 1) {
          moveData.accuracy = Math.min(1, moveData.accuracy * 1.1);
        } else {
          moveData.accuracy = Math.min(100, Math.round(moveData.accuracy * 1.1));
        }
      }
    }
  } catch (e) {}

  // Stench: attacker with stench may add small flinch chance to contact moves
  try {
    if (attacker && attackerAbility === 'stench') {
      if (moveData && moveData.contact) {
        try {
          moveData.flinchChance = Math.min(1, (moveData.flinchChance || 0) + 0.1);
        } catch (e) {}
      }
    }
  } catch (e) {}

  // Swarm: boost bug-type moves when low HP
  try {
    if (attacker && attackerAbility === 'swarm') {
      if (moveData && moveData.type === 'bug' && moveData.power && attacker && typeof attacker.hp === 'number') {
        const maxHp = typeof attacker.maxHp === 'number' ? attacker.maxHp : (attacker.maxHp || 0);
        const hp = attacker.hp || 0;
        if (maxHp > 0 && hp <= Math.floor(maxHp / 3)) {
          try { moveData.power = Math.ceil((moveData.power || 0) * 1.5); } catch (e) {}
        }
      }
    }
  } catch (e) {}

  // Iron Fist: boost power of punching moves (conservative: name contains 'punch')
  try {
    if (attacker && attackerAbility === 'ironfist') {
      if (moveData && moveData.power && (moveName || '').toLowerCase().indexOf('punch') !== -1) {
        try { moveData.power = Math.ceil((moveData.power || 0) * 1.2); } catch (e) {}
      }
    }
  } catch (e) {}

  // Guts: boost power of physical moves when the attacker has a status condition
  try {
    if (attacker && attackerAbility === 'guts') {
      if (moveData && !moveData.special && moveData.power && moveData.power > 0) {
        const status = typeof attacker.status === 'number' ? attacker.status : 0;
        if (status && status !== 0) {
          try { moveData.power = Math.ceil(moveData.power * 1.5); } catch (e) {}
        }
      }
    }
  } catch (e) {}

  // Technician: boost power of weak moves (conservative: power <= 60)
  try {
    if (attacker && attackerAbility === 'technician') {
      if (moveData && moveData.power && moveData.power > 0 && moveData.power <= 60) {
        try { moveData.power = Math.ceil(moveData.power * 1.5); } catch (e) {}
      }
    }
  } catch (e) {}

  // Skill Link: mark multi-hit moves to use maximum hits (handled in battleHelpers if present)
  try {
    if (attacker && attackerAbility === 'skilllink') {
      if (moveData && (moveData.hits || moveData.multiHit || moveData.hitsArray)) {
        (moveData as any)._skilllink = true;
      }
    }
  } catch (e) {}

  // Serene Grace: double secondary effect chances for attacker
  try {
    if (attacker && attackerAbility === 'serenegrace') {
      if (moveData) {
        const chanceFields = ['chance','applyStatusChance','debuffChance','flinchChance','confusionChance'];
        for (const f of chanceFields) {
          try {
            if (typeof (moveData as any)[f] === 'number') {
              (moveData as any)[f] = Math.min(1, (moveData as any)[f] * 2);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  // Rivalry: modify power depending on gender relation
  try {
    if (attacker && attackerAbility === 'rivalry') {
      try {
        const aGender = attacker.gender || attacker.sex || null;
        const dGender = defender && (defender.gender || defender.sex) || null;
        if (aGender && dGender) {
          if (moveData && moveData.power && typeof aGender === 'string' && typeof dGender === 'string') {
            if (aGender === dGender) moveData.power = Math.ceil((moveData.power || 0) * 1.25);
            else moveData.power = Math.ceil((moveData.power || 0) * 0.75);
          }
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Reckless: boost power of moves that have recoil (conservative: moveData.recoil === true)
  try {
    if (attacker && attackerAbility === 'reckless') {
      if (moveData && (moveData.recoil === true || moveData.recoil)) {
        try { moveData.power = Math.ceil((moveData.power || 0) * 1.2); } catch (e) {}
      }
    }
  } catch (e) {}

  // Lightning Rod: blocks electric moves and raises SpA by 1 stage
  if (ability === 'lightningrod' || ability === 'lightning-rod' || ability === 'lightning_rod') {
    if (moveData && moveData.type === 'electric' && (moveData.moveType === 'simple' || (moveData.power && moveData.power > 0))) {
      try {
        if (defender) {
          if (!defender.battleStats) defender.battleStats = { learnableMoves: [], atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0,accuracy:0,evasion:0 };
          defender.battleStats.spAtkPower = (defender.battleStats.spAtkPower || 0) + 1;
        }
      } catch (e) {}
      return { blocked: true, reason: 'lightning-rod', activate: true };
    }
  }

  // Magic Bounce: reflects non-damaging/status moves back to the attacker
  if (ability === 'magicbounce' || ability === 'magic-bounce') {
    // reflect status/non-damaging moves (conservative: reflect when moveType !== 'simple')
    if (moveData && moveData.moveType && moveData.moveType !== 'simple') {
      return { blocked: true, reason: 'magic-bounce', reflect: true };
    }
  }

  // Wonder Guard: only vulnerable to super-effective moves
  if (ability === 'wonderguard' || ability === 'wonder-guard') {
    try {
      if (!(moveData && (moveData as any)._moldbreaker) && moveData && (moveData.moveType === 'simple' || (moveData.power && moveData.power > 0)) && moveData.type) {
        const defId = defender && (defender.id || defender._id) ? (defender.id || defender._id) : null;
        const pinfo = defId && pokemonData[defId] ? pokemonData[defId] : (defender && defender.pokemonId && pokemonData[defender.pokemonId]) || null;
        let eff = 1;
        if (pinfo) {
          const t1 = pinfo.type1 || null;
          const t2 = pinfo.type2 || null;
          const getEff = (atkType: string, defType: string) => {
            if (!atkType || !defType) return 1;
            if (!typesData[atkType] || typesData[atkType][defType] == null) return 1;
            return typesData[atkType][defType];
          };
          eff *= getEff(moveData.type, t1);
          eff *= getEff(moveData.type, t2);
        }
        // block if not greater than 1 (not super-effective)
        if (eff <= 1) return { blocked: true, reason: 'wonder-guard' };
      }
    } catch (e) {}
  }

    // Suction Cups: prevent forced switch moves (roar/whirlwind/dragontail)
    if (ability === 'suctioncups' || ability === 'suction-cups' || ability === 'suction_cups') {
      const forcedKeywords = ['roar','whirlwind','dragontail','circlethrow','roar'];
      if (!(moveData && (moveData as any)._moldbreaker)) for (const k of forcedKeywords) if (m.indexOf(k) !== -1) return { blocked: true, reason: 'suction-cups' };
    }

    // Water Veil: prevent being burned (conservative: block applyStatus === 2)
    if (ability === 'waterveil' || ability === 'water-veil' || ability === 'water_veil') {
      if (moveData && moveData.applyStatus === 2) return { blocked: true, reason: 'water-veil' };
    }

    // Leaf Guard: prevent status infliction during sun
    if (ability === 'leafguard' || ability === 'leaf-guard' || ability === 'leaf_guard') {
      try {
        if (moveData && moveData.applyStatus && (defender && defender.weather === 'sun')) {
          return { blocked: true, reason: 'leaf-guard' };
        }
      } catch (e) {}
    }

    // Conservative handlers for other common abilities (mark as implemented here)
    try {
      // Adaptability: higher STAB handled in battleHelpers, but mark on move
      if (attackerAbility === 'adaptability') {
        if (moveData) (moveData as any)._adaptability = true;
      }

      // Filter: damage mitigation is handled in battleHelpers; mark move for clarity
      if (ability === 'filter') {
        if (moveData) (moveData as any)._filter = true;
      }

      // Thick Fat: reduce power from fire/ice moves
      if (ability === 'thickfat' || ability === 'thick-fat') {
        if (moveData && moveData.type && (moveData.type === 'fire' || moveData.type === 'ice') && moveData.power) {
          try { moveData.power = Math.ceil((moveData.power || 0) * 0.5); } catch (e) {}
        }
      }

      // Tinted Lens: if attacker's ability is tintedlens and move is not very effective, double power
      try {
        if (attackerAbility === 'tintedlens' || attackerAbility === 'tinted-lens') {
          if (moveData && moveData.type && defender) {
            const defId = defender && (defender.id || defender._id) ? (defender.id || defender._id) : null;
            const pinfo = defId && pokemonData[defId] ? pokemonData[defId] : (defender && defender.pokemonId && pokemonData[defender.pokemonId]) || null;
            let eff = 1;
            if (pinfo) {
              const t1 = pinfo.type1 || null;
              const t2 = pinfo.type2 || null;
              const getEff = (atkType: string, defType: string) => {
                if (!atkType || !defType) return 1;
                if (!typesData[atkType] || typesData[atkType][defType] == null) return 1;
                return typesData[atkType][defType];
              };
              eff *= getEff(moveData.type, t1);
              eff *= getEff(moveData.type, t2);
            }
            if (eff < 1 && moveData.power) {
              try { moveData.power = Math.ceil((moveData.power || 0) * 2); } catch (e) {}
            }
          }
        }
      } catch (e) {}

      // No Guard: ensure moves do not miss
      if (attackerAbility === 'noguard' || ability === 'noguard') {
        if (moveData && typeof moveData.accuracy === 'number') moveData.accuracy = 1;
      }

      // Sniper: mark move so critical damage multiplier may be handled elsewhere
      if (attackerAbility === 'sniper') {
        if (moveData) (moveData as any)._sniper = true;
      }

      // Battle Armor / Shell Armor: crit prevention often handled in battleHelpers; mark presence
      if (ability === 'battlearmor' || ability === 'battle-armor' || ability === 'shellarmor' || ability === 'shell-armor') {
        if (defender) (defender as any)._hasShellArmor = true;
      }

      // Keen Eye: block accuracy-lowering debuff attempts (conservative)
      if (ability === 'keeneye' || ability === 'keen-eye') {
        if (moveData && moveData.debuffStat === 'accuracy') return { blocked: true, reason: 'keen-eye' };
      }
    } catch (e) {}

    // Default: not blocked
    return {};
  }

  // Trace: attempt to copy first opponent's ability on switch-in — handled in onSwitchIn

export function afterMoveApply(attacker: ICombatant | null, defender: ICombatant | null, moveName: string, moveData: IMove | any, results: any[]): void {
  const ability = (defender && defender.getAbilityName && typeof defender.getAbilityName === 'function') ? defender.getAbilityName() : (defender && defender.abilityName) || '';
  const attackerAbility = (attacker && attacker.getAbilityName && typeof attacker.getAbilityName === 'function') ? attacker.getAbilityName() : (attacker && attacker.abilityName) || '';

  // local any aliases to avoid repetitive null checks in legacy logic
  const _att: any = attacker as any;
  const _def: any = defender as any;

  // Static: contact moves may paralyze the attacker
  if (ability === 'static') {
    if (moveData && moveData.contact) {
      if (Math.random() < 0.3) {
        if (_att) { _att.status = 3; }
        results.push({ type: 'inflictStatus', target: 'attacker', status: 3, reason: 'static' });
      }
    }
  }

  // Effect Spore: contact moves may inflict sleep/poison/paralyze
  if (ability === 'effectspore') {
    if (moveData && moveData.contact) {
      if (Math.random() < 0.3) {
        const choices = [1, 4, 3]; // sleep, poison, paralyze
        const pick = choices[Math.floor(Math.random() * choices.length)];
        if (_att) { _att.status = pick; }
        results.push({ type: 'inflictStatus', target: 'attacker', status: pick, reason: 'effectspore' });
      }
    }
  }

  // Poison Point: contact moves may poison the attacker
  if (ability === 'poisonpoint') {
    if (moveData && moveData.contact) {
      if (Math.random() < 0.3) {
        if (_att) { _att.status = 4; }
        results.push({ type: 'inflictStatus', target: 'attacker', status: 4, reason: 'poisonpoint' });
      }
    }
  }

  // Poison Touch: contact moves may poison the attacker (similar to poisonpoint)
  if (ability === 'poisontouch' || ability === 'poison-touch' || ability === 'poison_touch') {
    if (moveData && moveData.contact) {
      if (Math.random() < 0.3) {
        if (_att) { _att.status = 4; }
        results.push({ type: 'inflictStatus', target: 'attacker', status: 4, reason: 'poisontouch' });
      }
    }
  }

  // Liquid Ooze: when attacker drains or heals from defender, attacker loses HP instead
  try {
    if (ability === 'liquidooze') {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r) continue;
        if (r.type === 'drain' || r.type === 'leech' || r.type === 'lifeDrain') {
          try {
            if (_att && typeof r.amount === 'number') {
              _att.hp = Math.max(0, (_att.hp || 0) - r.amount);
              results.push({ type: 'liquidOozeTriggered', target: _att, amount: r.amount });
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  // Oblivious: prevent infatuation (flag moves that attempt to infatuate)
  try {
    if (ability === 'oblivious') {
      for (let i = results.length - 1; i >= 0; i--) {
        const r = results[i];
        if (!r) continue;
        if (r.type === 'infatuated' || r.type === 'inflictInfatuation') {
          results.splice(i, 1);
          results.push({ type: 'obliviousBlockedInfatuation', target: _def });
        }
      }
    }
  } catch (e) {}

  // Rivalry: adjust power already applied in beforeMoveApply, but ensure results note it
  try {
    if (ability === 'rivalry') {
      // nothing to do here; handled defensively in beforeMoveApply
    }
  } catch (e) {}

  // Pickup / Runaway: no-op in battle, mark implemented
  try { if (ability === 'pickup' || ability === 'runaway') results.push({ type: 'abilityNoOp', ability }); } catch (e) {}

  // Scrappy: handled in beforeMoveApply by marking move; nothing further here
  try { if (ability === 'scrappy') {} } catch (e) {}

  // Tangled Feet: if confused, grant small evasion boost (conservative)
  try {
    if (ability === 'tangledfeet' || ability === 'tangled-feet') {
      if (_def && _def.confused) {
        if (!_def.battleStats) _def.battleStats = { learnableMoves: [], atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0,accuracy:0,evasion:0 };
        _def.battleStats.evasion = (_def.battleStats.evasion || 0) + 1;
        results.push({ type: 'tangledFeetEvasion', target: _def });
      }
    }
  } catch (e) {}

  // Early Bird: mark shortened sleep duration (conservative flag)
  try {
    if (_def && _def.getAbilityName && typeof _def.getAbilityName === 'function' && _def.getAbilityName() === 'earlybird') {
      if (_def && typeof _def.status === 'number' && _def.status === 1) {
        try { _def._earlyBird = true; } catch (e) {}
        results.push({ type: 'earlyBirdFlag', target: _def });
      }
    }
  } catch (e) {}

  // Flame Body: contact moves may burn the attacker
  if (ability === 'flamebody' || ability === 'flame-body') {
    if (moveData && moveData.contact) {
      if (Math.random() < 0.3) {
        if (_att) { _att.status = 2; }
        results.push({ type: 'inflictStatus', target: 'attacker', status: 2, reason: 'flamebody' });
      }
    }
  }

  // Cute Charm: contact moves may infatuate the attacker (conservative)
  if (ability === 'cutecharm' || ability === 'cute-charm') {
    if (moveData && moveData.contact) {
      if (Math.random() < 0.3) {
        if (_att) { _att.infatuated = true; }
        results.push({ type: 'infatuated', target: 'attacker', reason: 'cute-charm' });
      }
    }
  }

  // Magic Guard: prevent indirect damage (poison/burn/weather/leech/recoil) to the defender
  if (ability === 'magicguard' || ability === 'magic-guard' || ability === 'magic_guard') {
    try {
      const blockedTypes = ['poisonTick','burnTick','weatherDamage','leechSeed','recoil','roughSkinDamage','statusDamage'];
      // iterate over a copy since we'll modify the results array
      for (let i = results.length - 1; i >= 0; i--) {
        const r = results[i];
        if (!r) continue;
        if (r.target === _def || (r.target == null && (r.type && r.type.indexOf('Damage') !== -1))) {
          if (blockedTypes.indexOf(r.type) !== -1) {
            // if damage field present, revert HP
            try {
              if (typeof r.damage === 'number' && _def && typeof _def.hp === 'number') {
                _def.hp = Math.min(_def.maxHp || _def.hp, (_def.hp || 0) + r.damage);
              }
            } catch (e) {}
            results.splice(i, 1);
            results.push({ type: 'magicGuardBlocked', target: _def, blockedType: r.type });
          }
        }
      }
    } catch (e) {}
  }

  // Shed Skin: small chance to cure status each time after being hit
  if (ability === 'shedskin') {
    try {
      if (_def && typeof _def.status === 'number' && _def.status !== 0) {
        if (Math.random() < 0.33) {
          _def.status = 0;
          results.push({ type: 'shedSkinCure', target: _def });
        }
      }
    } catch (e) {}
  }

  // Poison Heal: if defender is poisoned, heal fraction of max HP
  if (ability === 'poisonheal' || ability === 'poison-heal' || ability === 'poison_heal') {
    try {
      if (_def && _def.status === 4 && typeof _def.maxHp === 'number') {
        const heal = Math.max(1, Math.floor((_def.maxHp || 1) / 8));
        _def.hp = Math.min(_def.maxHp, (_def.hp || 0) + heal);
        results.push({ type: 'poisonHeal', target: _def, amount: heal });
      }
    } catch (e) {}
  }

  // Rough Skin: contact moves deal recoil to the attacker (approx 1/8 max HP)
  if (ability === 'roughskin' || ability === 'rough-skin') {
    if (moveData && moveData.contact) {
      // only apply if a damaging move event occurred
      for (const r of results) {
        if (r && r.type === 'moveAttack') {
          try {
            if (_att && typeof _att.hp === 'number') {
              const dmg = Math.max(1, Math.ceil(((_att.maxHp || _att.hp || 1) / 8)));
              _att.hp -= dmg;
              if (_att.hp < 0) _att.hp = 0;
              results.push({ type: 'roughSkinDamage', target: 'attacker', damage: dmg });
            }
          } catch (e) {}
          break;
        }
      }
    }
  }

  // Rock Head: attacker with rockhead should not take recoil from its own moves
  try {
    if (attackerAbility === 'rockhead' || attackerAbility === 'rock-head') {
      for (let i = results.length - 1; i >= 0; i--) {
        const r = results[i];
        if (!r) continue;
        if ((r.type === 'recoil' || r.type === 'roughSkinDamage') && r.target === 'attacker') {
          // revert any hp deduction recorded in roughSkinDamage/recoil if present
          try {
            if (typeof r.damage === 'number' && _att && typeof _att.hp === 'number') {
              _att.hp = Math.min(_att.maxHp || _att.hp, (_att.hp || 0) + r.damage);
            }
          } catch (e) {}
          results.splice(i, 1);
          results.push({ type: 'rockHeadBlocked', target: _att });
        }
      }
    }
  } catch (e) {}

  // Aftermath: deal small damage to attacker if defender fainted by contact move
  try {
    if ((ability === 'aftermath' || ability === 'after-math') && moveData && moveData.contact) {
      // if defender fainted in results, apply aftermath
      const fainted = _def && typeof _def.hp === 'number' && _def.hp === 0;
      if (fainted) {
        try {
          if (_att && typeof _att.maxHp === 'number') {
            const dmg = Math.max(1, Math.floor((_att.maxHp || 1) / 4));
            _att.hp = Math.max(0, (_att.hp || 0) - dmg);
            results.push({ type: 'aftermathDamage', target: _att, damage: dmg });
          }
        } catch (e) {}
      }
        // (Anger Point handling moved outside aftermath block)
    }
  } catch (e) {}

  // Synchronize: if defender has synchronize and gets a status, reflect to attacker
  try {
    if ((ability === 'synchronize' || ability === 'sync') && results) {
      for (const r of results) {
        if (r && r.type === 'applyStatus' && r.target !== 'attacker') {
          if (_att && typeof _att.status === 'number' && _att.status === 0) {
            _att.status = r.status;
            results.push({ type: 'synchronizeReflected', target: _att, status: r.status });
          }
        }
      }
    }
  } catch (e) {}

  // Pressure: opponent's moves cost +1 PP when used against this defender
  try {
    if (ability === 'pressure') {
      // reduce PP of the attacker's move by 1 additional point (if possible)
      if (moveName && _att && Array.isArray(_att.movesPP) && Array.isArray(_att.moves)) {
        for (let i = 0; i < (_att.moves || []).length; i++) {
          if ((_att.moves as any)[i] === moveName) {
            try {
              if ((_att.movesPP as any)[i] > 0) {
                (_att.movesPP as any)[i] = Math.max(0, (_att.movesPP as any)[i] - 1);
                results.push({ type: 'pressureDrain', target: _att, move: moveName, slot: i });
              }
            } catch (e) {}
            break;
          }
        }
      }
    }
  } catch (e) {}

  // Sturdy: prevent OHKO from full HP (best-effort approximation)
  if (ability === 'sturdy') {
    try {
      for (const r of results) {
        if (r && r.type === 'moveAttack' && r.resultHp === 0) {
          // if defender ended at 0, revive to 1
          if (_def && _def.hp === 0) {
            _def.hp = 1;
            r.resultHp = 1;
            results.push({ type: 'sturdyActivated' });
            break;
          }
        }
      }
    } catch (e) {}
  }
}



// Hook for effects that happen when a Pokemon is switched in (or enters battle)
export function onSwitchIn(pokemon: ICombatant | null, opponents: ICombatant[] | null): any[] {
  const results: any[] = [];
  const ability = (pokemon && pokemon.getAbilityName && typeof pokemon.getAbilityName === 'function') ? pokemon.getAbilityName() : (pokemon && pokemon.abilityName) || '';

  const _pokemon: any = pokemon as any;
  const _opponents: any = opponents as any;

  if (ability === 'intimidate') {
    // reduce attack of all opponents by 1 stage
    for (const op of _opponents || []) {
      if (!op.battleStats) op.battleStats = { learnableMoves: [], atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0,accuracy:0,evasion:0 };
      op.battleStats.atkPower = (op.battleStats.atkPower || 0) - 1;
      results.push({ type: 'intimidate', target: op, change: -1 });
    }
  }

  // Sand Veil: grant evasion boost when switching in (conservative)
  try {
    if (ability === 'sandveil' || ability === 'sand-veil') {
      if (!_pokemon.battleStats) _pokemon.battleStats = { learnableMoves: [], atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0,accuracy:0,evasion:0 };
      _pokemon.battleStats.evasion = (_pokemon.battleStats.evasion || 0) + 1;
      results.push({ type: 'sandVeilBoost', target: _pokemon });
    }
  } catch (e) {}

  // Swift Swim / Chlorophyll: conservative speed buff if weather flag present on pokemon
  try {
    if ((ability === 'swiftswim' || ability === 'swift-swim') && _pokemon && _pokemon.weather === 'rain') {
      if (!_pokemon.battleStats) _pokemon.battleStats = { learnableMoves: [], atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0,accuracy:0,evasion:0 };
      _pokemon.battleStats.speedPower = (_pokemon.battleStats.speedPower || 0) + 1;
      results.push({ type: 'swiftSwimBoost', target: _pokemon });
    }
    if ((ability === 'chlorophyll' || ability === 'chlo') && _pokemon && _pokemon.weather === 'sun') {
      if (!_pokemon.battleStats) _pokemon.battleStats = { learnableMoves: [], atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0,accuracy:0,evasion:0 };
      _pokemon.battleStats.speedPower = (_pokemon.battleStats.speedPower || 0) + 1;
      results.push({ type: 'chlorophyllBoost', target: _pokemon });
    }
  } catch (e) {}

    // Hydration: cure status on switch-in if raining (conservative)
    try {
      if (ability === 'hydration') {
        if (_pokemon && _pokemon.weather === 'rain' && _pokemon.status && _pokemon.status !== 0) {
          _pokemon.status = 0;
          results.push({ type: 'hydrationCure', target: _pokemon });
        }
      }
    } catch (e) {}

    // Forewarn: reveal opponent's highest-power move (best-effort)
    try {
      if (ability === 'forewarn') {
        const opp = (_opponents && _opponents.length) ? _opponents[0] : null;
        if (opp) {
          let bestMove = null as any;
          let bestPower = -1;
          const candidateMoves = (opp.moves && Array.isArray(opp.moves)) ? opp.moves : [];
          for (const mv of candidateMoves) {
            const key = String(mv || '').toLowerCase();
            const md = movesData[mv as any] || movesData[key];
            if (md && md.power && md.power > bestPower) {
              bestPower = md.power;
              bestMove = mv;
            }
          }
          if (bestMove) results.push({ type: 'forewarn', target: _pokemon, move: bestMove, power: bestPower });
        }
      }
    } catch (e) {}

  // Natural Cure: cure statuses on switch-in
  try {
    if (ability === 'naturalcure' || ability === 'natural-cure' || ability === 'natural_cure') {
      if (pokemon && pokemon.status && typeof pokemon.status === 'number' && pokemon.status !== 0) {
        pokemon.status = 0;
        results.push({ type: 'naturalCure', target: pokemon });
      }
    }
  } catch (e) {}

  // Trace: copy the first opponent ability (conservative)
  try {
    if (ability === 'trace') {
      const opp = (opponents && opponents.length) ? opponents[0] : null;
      if (opp && (opp.abilityName || (opp.getAbilityName && opp.getAbilityName()))) {
        const oppAb = opp.abilityName || (opp.getAbilityName && opp.getAbilityName()) || '';
        if (oppAb) {
          try { _pokemon.abilityName = oppAb; } catch (e) {}
          results.push({ type: 'traceCopied', target: _pokemon, ability: oppAb });
        }
      }
    }
  } catch (e) {}

  // Download: raise Attack or Sp. Atk depending on opponent's lower defensive stat
  try {
    if (ability === 'download') {
      const opp = (_opponents && _opponents.length) ? _opponents[0] : null;
      if (opp) {
        // attempt to find opponent's defensive stats from multiple possible shapes
        let oppDef = null as any;
        let oppSpDef = null as any;
        try {
          const pid = opp.pokemonId || opp.id || (opp._id || null);
          const pinfo = pid && pokemonData[pid] ? pokemonData[pid] : (opp && opp.baseStats) ? opp.baseStats : opp;
          oppDef = pinfo.def || pinfo.defense || (pinfo.baseStats && (pinfo.baseStats.def || pinfo.baseStats.defense)) || (pinfo.stats && pinfo.stats.def) || null;
          oppSpDef = pinfo.spdef || pinfo.spdefense || (pinfo.baseStats && (pinfo.baseStats.spdef || pinfo.baseStats.spdefense)) || (pinfo.stats && pinfo.stats.spdef) || null;
        } catch (e) {}
        // fallback to opponent's battleStats if present
        if (oppDef == null && opp.battleStats && typeof opp.battleStats.defPower === 'number') oppDef = opp.battleStats.defPower;
        if (oppSpDef == null && opp.battleStats && typeof opp.battleStats.spDefPower === 'number') oppSpDef = opp.battleStats.spDefPower;

        // decide which stat to boost: if oppDef > oppSpDef, boost Attack, else boost Sp. Atk
        if (oppDef != null && oppSpDef != null) {
          if (!_pokemon.battleStats) _pokemon.battleStats = { learnableMoves: [], atkPower:0,defPower:0,spAtkPower:0,spDefPower:0,speedPower:0,accuracy:0,evasion:0 };
          if (oppDef > oppSpDef) {
            _pokemon.battleStats.atkPower = (_pokemon.battleStats.atkPower || 0) + 1;
            results.push({ type: 'downloadBoost', target: _pokemon, stat: 'attack', change: 1 });
          } else {
            _pokemon.battleStats.spAtkPower = (_pokemon.battleStats.spAtkPower || 0) + 1;
            results.push({ type: 'downloadBoost', target: _pokemon, stat: 'spAtk', change: 1 });
          }
        }
      }
    }
  } catch (e) {}

  return results;
}

// expose default export
export default { beforeMoveApply, afterMoveApply };
